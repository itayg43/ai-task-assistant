import Redlock from "redlock";

import { env } from "@config/env";
import { redis } from "@clients/redis";

export const redlock = new Redlock([redis], {
  retryCount: env.REDLOCK_RETRY_COUNT,
  retryDelay: env.REDLOCK_RETRY_DELAY_MS,
  retryJitter: env.REDLOCK_RETRY_JITTER_MS,
});
