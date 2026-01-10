import * as amqp from "amqplib";

import { env } from "@config/env";
import {
  closeRabbitMQConnection,
  createRabbitMQConnection,
} from "@shared/clients/rabbitmq";

let rabbitMQConnection: amqp.ChannelModel | null = null;

export const connectRabbitMQClient = async () => {
  rabbitMQConnection = await createRabbitMQConnection(env.RABBITMQ_URL);
};

export const closeRabbitMQClient = async () => {
  if (rabbitMQConnection) {
    await closeRabbitMQConnection(rabbitMQConnection);
    rabbitMQConnection = null;
  }
};

export const getRabbitMQConnection = (): amqp.ChannelModel => {
  if (!rabbitMQConnection) {
    throw new Error("RabbitMQ connection not initialized");
  }

  return rabbitMQConnection;
};
