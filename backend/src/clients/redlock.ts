import Redlock from "redlock";

import { redis } from "./redis";
import { env } from "@config";

export const redlock = new Redlock([redis], {
  retryCount: env.REDLOCK_RETRY_COUNT,
  retryDelay: env.REDLOCK_RETRY_DELAY,
  retryJitter: env.REDLOCK_RETRY_JITTER,
});
