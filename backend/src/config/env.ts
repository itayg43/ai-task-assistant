import dotenv from "dotenv";
import { cleanEnv, port, str, num } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  PORT: port(),

  REDIS_URL: str(),

  REDLOCK_RETRY_COUNT: num(),
  REDLOCK_RETRY_DELAY: num(),
  REDLOCK_RETRY_JITTER: num(),

  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_NAME: str(),
  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_SIZE: num(),
  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_REFILL_RATE: num(),
  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_TTL_SECONDS: num(),
  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_LOCK_TTL_MS: num(),
});
