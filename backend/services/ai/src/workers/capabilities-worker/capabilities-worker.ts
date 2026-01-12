import * as amqp from "amqplib";

import { capabilities } from "@capabilities";
import { getRabbitMQChannel } from "@clients/rabbitmq";
import { tasksClient } from "@clients/tasks";
import {
  AI_ERROR_TYPE,
  CAPABILITY_EXECUTION_ERROR_MESSAGE,
  RABBITMQ_QUEUE,
} from "@constants";
import { capabilitiesQueueMessageDataSchema } from "@schemas";
import { createLogger } from "@shared/config/create-logger";
import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { BadRequestError, InternalError } from "@shared/errors";
import { ExtractedErrorInfo } from "@shared/types";
import { extractErrorInfo } from "@shared/utils/extract-error-info";
import { withRetry } from "@shared/utils/with-retry";
import { CapabilityConfig } from "@types";
import { ZodError } from "zod";

const logger = createLogger("capabilitiesWorker");

const sendCallbackHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage,
  requestId: string | undefined,
  callbackUrl: string,
  payload:
    | { success: true; result: unknown }
    | { success: false; error: ExtractedErrorInfo }
) => {
  try {
    await withRetry(
      DEFAULT_RETRY_CONFIG,
      async () => {
        await tasksClient.post(callbackUrl, {
          ...payload,
          aiServiceRequestId: requestId,
        });
      },
      {
        operation: "sendCallbackHandler",
      }
    );

    channel.ack(message);
  } catch (error) {
    logger.error(
      `Failed to send ${payload.success ? "success" : "error"} callback`,
      error,
      {
        requestId,
        callbackUrl,
      }
    );

    channel.nack(message, false, false);
  }
};

const executeCapabilityHandler = async <TInput, TOutput>(
  requestId: string,
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput
) => {
  try {
    const handlerResult = await config.handler(input, requestId);

    return config.outputSchema.parse(handlerResult);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.error(
        `Capability ${config.name} returned output that failed validation.`,
        error,
        {
          requestId,
          capability: config.name,
          validationErrorMessage: error.message,
        }
      );

      // Rethrow with generic message to prevent leaking internal validation details.
      // InternalError (500) because output validation failures indicate a bug in handler logic.
      throw new InternalError(CAPABILITY_EXECUTION_ERROR_MESSAGE);
    }

    throw error;
  }
};

const parseMessageData = (message: amqp.ConsumeMessage) => {
  try {
    const parsedMessage = JSON.parse(message.content.toString());
    return capabilitiesQueueMessageDataSchema.parse(parsedMessage);
  } catch (error) {
    logger.error("Failed to parse message data", error);
    return null;
  }
};

const capabilitiesMessageHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage
) => {
  let reqId: string | undefined;
  let cbUrl: string | undefined;

  try {
    const parsedMessageData = parseMessageData(message);
    if (!parsedMessageData) {
      channel.nack(message, false, false);
      return;
    }

    const { requestId, capability, input, callbackUrl } = parsedMessageData;
    reqId = requestId;
    cbUrl = callbackUrl;

    const config = capabilities[capability];
    if (!config) {
      throw new BadRequestError(`Capability ${capability} not found`);
    }

    const validatedInput = config.inputSchema.parse(input);
    const result = await executeCapabilityHandler(
      requestId,
      config,
      validatedInput
    );

    await sendCallbackHandler(channel, message, requestId, callbackUrl, {
      success: true,
      result,
    });
  } catch (error) {
    const errorInfo = extractErrorInfo(error);

    if (cbUrl) {
      await sendCallbackHandler(channel, message, reqId, cbUrl, {
        success: false,
        error: errorInfo,
      });
    }
  }
};

export const consumeCapabilitiesMessage = async () => {
  try {
    const channel = await getRabbitMQChannel(RABBITMQ_QUEUE.CAPABILITIES);
    await channel.prefetch(1);
    await channel.consume(
      RABBITMQ_QUEUE.CAPABILITIES,
      async (message) => {
        if (!message) {
          return;
        }

        await capabilitiesMessageHandler(channel, message);
      },
      {
        noAck: false,
      }
    );
  } catch (error) {
    const errorMessage = "Failed to consume message";

    logger.error(errorMessage, error);

    throw new InternalError(errorMessage, {
      type: AI_ERROR_TYPE.RABBITMQ_CONSUME_MESSAGE_FAILED,
    });
  }
};
