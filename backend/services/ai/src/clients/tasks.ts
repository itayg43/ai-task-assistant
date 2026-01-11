import { env } from "@config/env";
import { createHttpClient } from "@shared/clients/http";

export const tasksClient = createHttpClient(
  "",
  `http://${env.SERVICE_NAME}:${env.SERVICE_PORT}`
);
