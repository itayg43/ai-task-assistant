import { createClient } from "redis";

import { env } from "@config";
import { createLogger } from "@config/logger";
import { TAG } from "@constants";

const logger = createLogger(TAG.REDIS);

export const redisClient = createClient({
  url: env.REDIS_URL,
});

redisClient.on("connect", () => {
  logger.info("Redis client connected");
});

redisClient.on("ready", () => {
  logger.info("Redis client ready");
});

redisClient.on("end", () => {
  logger.info("Redis client disconnected");
});

redisClient.on("error", (error) => {
  logger.error("Redis client error", { error });
});

redisClient.on("reconnecting", () => {
  logger.info("Redis client reconnecting");
});
