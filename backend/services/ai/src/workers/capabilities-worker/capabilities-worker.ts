import * as amqp from "amqplib";

import { capabilities } from "@capabilities";
import { getRabbitMQChannel } from "@clients/rabbitmq";
import { tasksClient } from "@clients/tasks";
import { AI_ERROR_TYPE, RABBITMQ_QUEUE } from "@constants";
import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
import { capabilitiesQueueMessageDataSchema } from "@schemas";
import { createLogger } from "@shared/config/create-logger";
import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { BadRequestError, InternalError } from "@shared/errors";
import { ExtractedErrorInfo } from "@shared/types";
import { extractErrorInfo } from "@shared/utils/extract-error-info";
import { withRetry } from "@shared/utils/with-retry";

const logger = createLogger("capabilitiesWorker");

const sendSuccessCallbackHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage,
  requestId: string,
  callbackUrl: string,
  result: unknown
) => {
  try {
    await withRetry(
      DEFAULT_RETRY_CONFIG,
      async () => {
        await tasksClient.post(callbackUrl, {
          success: true,
          result,
          aiServiceRequestId: requestId,
        });
      },
      {
        operation: "sendSuccessCallbackHandler",
      }
    );

    channel.ack(message);
  } catch (error) {
    logger.error("Failed to send success callback", error, {
      requestId,
      callbackUrl,
    });

    channel.nack(message, false, false);
  }
};

const sendErrorCallbackHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage,
  requestId: string | undefined,
  callbackUrl: string,
  errorInfo: ExtractedErrorInfo
) => {
  try {
    await withRetry(
      DEFAULT_RETRY_CONFIG,
      async () => {
        await tasksClient.post(callbackUrl, {
          success: false,
          error: errorInfo,
          aiServiceRequestId: requestId,
        });
      },
      {
        operation: "sendErrorCallbackHandler",
      }
    );

    channel.ack(message);
  } catch (error) {
    logger.error("Failed to send error callback", error, {
      requestId,
      callbackUrl,
    });

    channel.nack(message, false, false);
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
    const result = await executeSyncPattern(requestId, config, validatedInput);

    await sendSuccessCallbackHandler(
      channel,
      message,
      requestId,
      callbackUrl,
      result
    );
  } catch (error) {
    const errorInfo = extractErrorInfo(error);

    if (cbUrl) {
      await sendErrorCallbackHandler(channel, message, reqId, cbUrl, errorInfo);
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
