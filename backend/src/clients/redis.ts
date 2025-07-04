import { createClient } from "redis";

import { env, createLogger } from "@config";
import { TAG } from "@constants";

const logger = createLogger(TAG.REDIS);

export const redisClient = createClient({
  url: env.REDIS_URL,
});

export const connectRedisClient = async () => {
  await redisClient.connect();
  logger.info("Redis client connected");
};

export const closeRedisClient = async () => {
  logger.info("Closing redis client...");
  try {
    await redisClient.close();
    logger.info("Redis client closed successfully");
  } catch (error) {
    logger.error("Error while closing redis client:", {
      error,
    });
  }
};

export const destroyRedisClient = () => {
  redisClient.destroy();
  logger.info("Redis client destroyed successfully");
};

redisClient.on("error", (error) => {
  logger.error("Redis client error", {
    error,
  });
});
