import http from "http";

import { connectRedisClient } from "@clients";
import { createLogger, env } from "@config";
import { TAG } from "@constants";
import { registerProcessEventHandlers } from "@utils";
import { app } from "./app";

const logger = createLogger(TAG.SERVER);

const server = http.createServer(app);

(async () => {
  logger.info("###### Initialize server ######");

  await connectRedisClient();

  registerProcessEventHandlers(server);

  server.listen(env.PORT, () => {
    logger.info(`Running at http://localhost:${env.PORT}`);
  });
})();
