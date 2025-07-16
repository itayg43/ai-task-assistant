import http from "http";

import { connectRedisClient } from "@clients";
import { env } from "@config/env";
import { createLogger } from "@config/logger";
import { EXIT_CODE, TAG } from "@constants";
import { registerProcessEventHandlers, startServer } from "@utils";
import { app } from "./app";

const logger = createLogger(TAG.SERVER);

const server = http.createServer(app);

(async () => {
  try {
    logger.info("###### Initialize server ######");

    await connectRedisClient();
    registerProcessEventHandlers(server);
    await startServer(server, env.PORT);

    logger.info("###### Initialize server completed ######");
  } catch (error) {
    logger.error("###### Initialize server failed ######", {
      error,
    });

    process.exit(EXIT_CODE.ERROR);
  }
})();
