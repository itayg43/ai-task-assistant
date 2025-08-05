import dotenv from "dotenv";
import { cleanEnv, port, str } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  SERVICE_NAME: str(),
  SERVICE_PORT: port(),

  OPENAI_API_KEY: str(),
});
