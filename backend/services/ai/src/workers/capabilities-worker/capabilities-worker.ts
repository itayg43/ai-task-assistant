import * as amqp from "amqplib";

import { capabilities } from "@capabilities";
import { getRabbitMQChannel } from "@clients/rabbitmq";
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

const wait = async (delayMs: number = 1500) => {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

const sendSuccessCallbackHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage,
  requestId: string,
  _callbackUrl: string,
  _result: unknown
) => {
  try {
    await withRetry(DEFAULT_RETRY_CONFIG, wait, {
      operation: "sendSuccessCallback",
    });

    channel.ack(message);
  } catch (error) {
    logger.error("Failed to send success callback", error, {
      requestId,
    });

    channel.nack(message, false, false);
  }
};

const sendErrorCallbackHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage,
  requestId: string | undefined,
  _errorInfo: ExtractedErrorInfo
) => {
  try {
    await withRetry(DEFAULT_RETRY_CONFIG, wait, {
      operation: "sendErrorCallback",
    });

    channel.ack(message);
  } catch (error) {
    logger.error("Failed to send error callback", error, {
      requestId,
    });

    channel.nack(message, false, false);
  }
};

const capabilitiesMessageHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage
) => {
  let reqId: string | undefined;

  try {
    const parsedMessage = JSON.parse(message.content.toString());
    const { requestId, capability, input, callbackUrl } =
      capabilitiesQueueMessageDataSchema.parse(parsedMessage);
    reqId = requestId;

    const config = capabilities[capability];
    if (!config) {
      throw new BadRequestError(`Capability ${capability} not found`);
    }

    const validatedInput = config.inputSchema.parse(input);
    const result = await executeSyncPattern(requestId, config, validatedInput);

    // send success callback - handler will ack/nack
    await sendSuccessCallbackHandler(
      channel,
      message,
      requestId,
      callbackUrl,
      result
    );
  } catch (error) {
    const errorInfo = extractErrorInfo(error);

    // send error callback - handler will ack/nack
    await sendErrorCallbackHandler(channel, message, reqId, errorInfo);
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
