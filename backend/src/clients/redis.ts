import { createClient } from "redis";

import { env, createLogger } from "@config";
import { TAG } from "@constants";

const logger = createLogger(TAG.REDIS);

export const redisClient = createClient({
  url: env.REDIS_URL,
});

export const connectRedisClient = async () => {
  logger.info("Connecting redis client...");
  await redisClient.connect();
  logger.info("Redis client connected");
};

export const closeRedisClient = async () => {
  logger.info("Closing redis client...");
  await redisClient.close();
  logger.info("Redis client closed");
};

export const destroyRedisClient = () => {
  logger.info("Destroying redis client...");
  redisClient.destroy();
  logger.info("Redis client destroyed");
};

redisClient.on("error", (error) => {
  logger.error("Redis client error", {
    error,
  });
});
