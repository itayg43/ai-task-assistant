import * as amqp from "amqplib";
import { ZodError } from "zod";

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
import { CapabilitiesQueueMessageData, CapabilityConfig } from "@types";

const logger = createLogger("capabilitiesConsumer");

const sendCallbackHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage,
  requestId: string | undefined,
  callbackUrl: string,
  payload:
    | { success: true; result: unknown }
    | { success: false; error: ExtractedErrorInfo },
) => {
  try {
    logger.info("Sending callback to service", {
      requestId,
      callbackUrl,
      success: payload.success,
    });

    await withRetry(
      DEFAULT_RETRY_CONFIG,
      async () => {
        await tasksClient.post(callbackUrl, {
          ...payload,
          aiServiceRequestId: requestId,
        });
      },
      {
        requestId: requestId,
        operation: "sendCallbackHandler",
      },
    );

    logger.info("Callback sent successfully to service", {
      requestId,
      callbackUrl,
      success: payload.success,
    });

    channel.ack(message);
  } catch (error) {
    logger.error(
      `Failed to send ${payload.success ? "success" : "error"} callback`,
      error,
      {
        requestId,
        callbackUrl,
      },
    );

    channel.nack(message, false, false);
  }
};

const executeCapabilityHandler = async <TInput, TOutput>(
  requestId: string,
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput,
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
        },
      );

      // Rethrow with generic message to prevent leaking internal validation details.
      // InternalError (500) because output validation failures indicate a bug in handler logic.
      throw new InternalError(CAPABILITY_EXECUTION_ERROR_MESSAGE);
    }

    throw error;
  }
};

const capabilitiesMessageHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage,
  messageData: CapabilitiesQueueMessageData,
) => {
  const { requestId, capability, input, callbackUrl } = messageData;

  logger.info(
    `Received ${capability} capability execution message from queue`,
    { requestId },
  );

  try {
    const config = capabilities[capability];
    if (!config) {
      throw new BadRequestError(`Capability ${capability} not found`);
    }

    const validatedInput = config.inputSchema.parse(input);
    const result = await executeCapabilityHandler(
      requestId,
      config,
      validatedInput,
    );

    logger.info(
      `Capability execution completed successfully for ${capability}`,
      { requestId },
    );

    await sendCallbackHandler(channel, message, requestId, callbackUrl, {
      success: true,
      result,
    });
  } catch (error) {
    logger.error(`Capability execution failed for ${capability}`, error, {
      requestId,
    });

    await sendCallbackHandler(channel, message, requestId, callbackUrl, {
      success: false,
      error: extractErrorInfo(error),
    });
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

        try {
          const parsedMessage = JSON.parse(message.content.toString());
          const validatedMessageData =
            capabilitiesQueueMessageDataSchema.parse(parsedMessage);
          await capabilitiesMessageHandler(
            channel,
            message,
            validatedMessageData,
          );
        } catch (error) {
          logger.warn("Failed to parse message data, nacking message");
          channel.nack(message, false, false);
        }
      },
      {
        noAck: false,
      },
    );
  } catch (error) {
    const errorMessage = "Failed to consume message";

    logger.error(errorMessage, error);

    throw new InternalError(errorMessage, {
      type: AI_ERROR_TYPE.RABBITMQ_CONSUME_MESSAGE_FAILED,
    });
  }
};
