import Redis, { RedisOptions } from "ioredis";

import { createLogger } from "../config/create-logger";

const logger = createLogger("redis");

export const createRedisClient = (
  url: string,
  options: Pick<RedisOptions, "connectTimeout">
) => {
  const redis = new Redis(url, options);

  redis.on("error", (error) => logger.error("Redis client error", error));

  return redis;
};

/**
 * Waits for the Redis client to emit the "ready" event, indicating it is fully initialized and ready for use.
 * Implements a manual timeout to ensure the app startup does not hang indefinitely if Redis is slow to become ready.
 * Note: This timeout is in addition to the Redis client's `connectTimeout` option, which only covers the TCP connection phase.
 */
export const connectRedisClient = async (
  redis: Redis,
  readyTimeoutMs: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Redis client connection timeout"));
    }, readyTimeoutMs);

    redis.once("connecting", () => {
      logger.info("Connecting redis client...");
    });

    redis.once("connect", () => {
      logger.info("Redis client connected");
    });

    redis.once("ready", () => {
      clearTimeout(timer);
      logger.info("Redis client ready");
      resolve();
    });
  });
};

export const closeRedisClient = async (redis: Redis) => {
  logger.info("Closing redis client...");
  await redis.quit();
  logger.info("Redis client closed");
};

export const destroyRedisClient = (redis: Redis) => {
  logger.info("Destroying redis client...");
  redis.disconnect();
  logger.info("Redis client destroyed");
};
