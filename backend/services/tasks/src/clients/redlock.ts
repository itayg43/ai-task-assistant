import { redis } from "@clients/redis";
import { createRedlockClient } from "@shared/clients/redlock";
import { env } from "../env";

export const redlock = createRedlockClient([redis], {
  retryCount: env.REDLOCK_RETRY_COUNT,
  retryDelay: env.REDLOCK_RETRY_DELAY_MS,
  retryJitter: env.REDLOCK_RETRY_JITTER_MS,
});
