import dotenv from "dotenv";
import { cleanEnv, num, port, str } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  SERVICE_NAME: str(),
  SERVICE_PORT: port(),

  REDIS_URL: str(),
  REDIS_CONNECT_TIMEOUT_MS: num(),
  REDIS_READY_TIMEOUT_MS: num(),

  REDLOCK_RETRY_COUNT: num(),
  REDLOCK_RETRY_DELAY_MS: num(),
  REDLOCK_RETRY_JITTER_MS: num(),

  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_NAME: str(),
  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_SIZE: num(),
  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_REFILL_RATE: num(),
  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_TTL_SECONDS: num(),
  GLOBAL_TOKEN_BUCKET_RATE_LIMITER_LOCK_TTL_MS: num(),
});
