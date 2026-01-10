import * as amqp from "amqplib";

import { env } from "@config/env";
import {
  closeRabbitMQConnection,
  createRabbitMQConnection,
} from "@shared/clients/rabbitmq";
import { QueueToMessageDataMap, RabbitMQQueue } from "@types";

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
  const channel = await getRabbitMQChannel(queue);

  channel.sendToQueue(queue, Buffer.from(JSON.stringify(messageData)), {
    persistent: true,
  });
};
