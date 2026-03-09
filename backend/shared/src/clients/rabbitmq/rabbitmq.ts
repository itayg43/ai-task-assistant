import * as amqp from "amqplib";

import { createLogger } from "../../config/create-logger";
import { withRetry } from "../../utils/with-retry";

const logger = createLogger("rabbitmq");

export const createRabbitMQConnection = async (
  url: string
): Promise<amqp.ChannelModel> => {
  return withRetry(
    async () => {
      logger.info("Connecting to RabbitMQ...");

      const connection = await amqp.connect(url);

      logger.info("RabbitMQ connection established");

      connection.on("error", (error: Error) => {
        logger.error("RabbitMQ connection error", error);
      });

      return connection;
    },
    {
      operation: "createRabbitMQConnection",
    }
  );
};

export const closeRabbitMQConnection = async (
  connection: amqp.ChannelModel
): Promise<void> => {
  logger.info("Closing RabbitMQ connection...");

  try {
    await connection.close();

    logger.info("RabbitMQ connection closed");
  } catch (error) {
    logger.error("Error closing RabbitMQ connection", error);

    throw error;
  }
};
