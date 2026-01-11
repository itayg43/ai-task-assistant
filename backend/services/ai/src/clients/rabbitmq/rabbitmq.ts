import * as amqp from "amqplib";

import { env } from "@config/env";
import { AI_ERROR_TYPE } from "@constants";
import {
  closeRabbitMQConnection,
  createRabbitMQConnection,
} from "@shared/clients/rabbitmq";
import { createLogger } from "@shared/config/create-logger";
import { ServiceUnavailableError } from "@shared/errors";
import { QueueToMessageDataMap, RabbitMQQueue } from "@types";

const logger = createLogger("rabbitmq");

let globalConnection: amqp.ChannelModel | null = null;
let globalChannel: amqp.Channel | null = null;

export const connectRabbitMQClient = async () => {
  globalConnection = await createRabbitMQConnection(env.RABBITMQ_URL);
};

export const closeRabbitMQClient = async () => {
  if (globalChannel) {
    await globalChannel.close();
    globalChannel = null;
  }

  if (globalConnection) {
    await closeRabbitMQConnection(globalConnection);
    globalConnection = null;
  }
};

export const getRabbitMQConnection = (): amqp.ChannelModel => {
  if (!globalConnection) {
    throw new Error("Global rabbitmq connection not initialized");
  }

  return globalConnection;
};

export const getRabbitMQChannel = async (
  queue: RabbitMQQueue
): Promise<amqp.Channel> => {
  const connection = getRabbitMQConnection();

  if (!globalChannel) {
    globalChannel = await connection.createChannel();

    globalChannel.on("error", (error: Error) => {
      logger.error("RabbitMQ channel error", error);
      globalChannel = null;
    });

    globalChannel.on("close", () => {
      logger.warn("RabbitMQ channel closed");
      globalChannel = null;
    });
  }

  await globalChannel.assertQueue(queue, {
    durable: true,
  });

  return globalChannel;
};

export const sendMessageToRabbitMQQueue = async <TQueue extends RabbitMQQueue>(
  queue: TQueue,
  messageData: QueueToMessageDataMap[TQueue]
) => {
  try {
    const channel = await getRabbitMQChannel(queue);

    const sent = channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(messageData)),
      {
        persistent: true,
      }
    );

    if (!sent) {
      throw new ServiceUnavailableError(
        `Channel buffer full, failed to send message to ${queue} queue`,
        {
          queue,
          type: AI_ERROR_TYPE.RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED,
        }
      );
    }
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    throw new ServiceUnavailableError(
      `Failed to send message to ${queue} queue`,
      {
        queue,
        type: AI_ERROR_TYPE.RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED,
      }
    );
  }
};
