import Redlock from "redlock";

import { redis } from "@clients/redis";
import { env } from "../env";

export const redlock = new Redlock([redis], {
  retryCount: env.REDLOCK_RETRY_COUNT,
  retryDelay: env.REDLOCK_RETRY_DELAY_MS,
  retryJitter: env.REDLOCK_RETRY_JITTER_MS,
});
