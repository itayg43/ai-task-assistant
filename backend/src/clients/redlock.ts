import Redlock from "redlock";

import { redisClient } from "./redis";
import { env } from "@config";

export const redlock = new Redlock([redisClient], {
  retryCount: env.REDLOCK_RETRY_COUNT,
  retryDelay: env.REDLOCK_RETRY_DELAY,
  retryJitter: env.REDLOCK_RETRY_JITTER,
});
