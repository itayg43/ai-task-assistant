import dotenv from "dotenv";
import { cleanEnv, port, str } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  PORT: port(),
  REDIS_URL: str(),
});
