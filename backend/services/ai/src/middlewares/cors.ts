import { createCors } from "@shared/middlewares/cors/create-cors";
import { env } from "src/env";

export const cors = createCors([
  `http://localhost:${env.SERVICE_PORT}`,
  `http://tasks:${env.SERVICE_PORT}`,
]);
