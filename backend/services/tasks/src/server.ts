import http from "http";

import { connectRedisClient } from "@clients/redis";
import { env } from "@config/env";
import { createLogger } from "@config/logger";
import { EXIT_CODE } from "@constants";
import { registerProcessEventHandlers } from "@utils/process-event/register-process-event-handlers";
import { startServer } from "@utils/start-server";
import { app } from "./app";

const logger = createLogger("server");

const server = http.createServer(app);

(async () => {
  try {
    logger.info("###### Initialize server ######");

    await connectRedisClient();
    registerProcessEventHandlers(server);
    await startServer(server, env.PORT);

    logger.info("###### Initialize server completed ######");
  } catch (error) {
    logger.error("###### Initialize server failed ######", error);

    process.exit(EXIT_CODE.ERROR);
  }
})();
