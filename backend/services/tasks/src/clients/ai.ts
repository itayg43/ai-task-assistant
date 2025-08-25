import axios from "axios";

import { env } from "@config/env";

export const ai = axios.create({
  baseURL: env.AI_SERVICE_URL,
  headers: {
    Origin: `http://${env.SERVICE_NAME}:${env.SERVICE_PORT}`,
  },
});
