import * as amqp from "amqplib";

import { capabilities } from "@capabilities";
import { getRabbitMQChannel } from "@clients/rabbitmq";
import { AI_ERROR_TYPE, RABBITMQ_QUEUE } from "@constants";
import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
import { capabilitiesQueueMessageDataSchema } from "@schemas";
import { createLogger } from "@shared/config/create-logger";
import { BadRequestError, InternalError } from "@shared/errors";

const logger = createLogger("capabilitiesWorker");

const capabilitiesMessageHandler = async (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage
) => {
  try {
    const parsedMessage = JSON.parse(message.content.toString());
    const validatedMessage =
      capabilitiesQueueMessageDataSchema.parse(parsedMessage);
    const { requestId, capability, input, callbackUrl } = validatedMessage;

    const config = capabilities[capability];

    if (!config) {
      throw new BadRequestError(`Capability ${capability} not found`);
    }

    const validatedInput = config.inputSchema.parse(input);
    const result = await executeSyncPattern(requestId, config, validatedInput);

    // send callback the result

    channel.ack(message);
  } catch (error) {
    // send callback the error

    channel.ack(message);
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

        capabilitiesMessageHandler(channel, message);
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
