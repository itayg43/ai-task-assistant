import { env } from "@config/env";
import { createHttpClient } from "@shared/clients/http";

export const ai = createHttpClient(
  env.AI_SERVICE_URL,
  `http://${env.SERVICE_NAME}:${env.SERVICE_PORT}`
);
