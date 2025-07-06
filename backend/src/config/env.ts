import dotenv from "dotenv";
import { cleanEnv, port, str, num } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  PORT: port(),
  REDIS_URL: str(),
  REDLOCK_RETRY_COUNT: num(),
  REDLOCK_RETRY_DELAY: num(),
  REDLOCK_RETRY_JITTER: num(),
});
