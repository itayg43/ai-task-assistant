import Redlock from "redlock";

import { redis } from "./redis";
import { env } from "@config";

export const redlock = new Redlock([redis], {
  retryCount: env.REDLOCK_RETRY_COUNT,
  retryDelay: env.REDLOCK_RETRY_DELAY_MS,
  retryJitter: env.REDLOCK_RETRY_JITTER_MS,
});
