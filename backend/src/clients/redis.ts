import { Redis } from "ioredis";

import { env, createLogger } from "@config";
import { TAG } from "@constants";

const logger = createLogger(TAG.REDIS);

export const redis = new Redis(env.REDIS_URL);

redis.on("connect", () => logger.info("Redis client connected"));

redis.on("error", (error) =>
  logger.error("Redis client error", {
    error,
  })
);

export const closeRedisClient = async () => {
  logger.info("Closing redis client...");
  await redis.quit();
  logger.info("Redis client closed");
};

export const destroyRedisClient = () => {
  logger.info("Destroying redis client...");
  redis.disconnect();
  logger.info("Redis client destroyed");
};
