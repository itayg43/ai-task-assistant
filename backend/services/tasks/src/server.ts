import http from "http";

import {
  closeRedisClient,
  connectRedisClient,
  destroyRedisClient,
} from "@clients/redis";
import { createLogger } from "@shared/config/create-logger";
import { PROCESS_EXIT_CODE } from "@shared/constants";
import { registerProcessEventHandlers } from "@shared/utils/process-event/register-process-event-handlers";
import { startServer } from "@shared/utils/start-server";
import { app } from "./app";
import { env } from "./env";

const logger = createLogger("server");

(async () => {
  try {
    const server = http.createServer(app);

    logger.info("###### Initialize server ######");

    await connectRedisClient();

    registerProcessEventHandlers(server, process.exit, {
      afterSuccess: async () => {
        await closeRedisClient();
      },
      afterFailure: () => {
        destroyRedisClient();
      },
    });

    await startServer(server, env.SERVICE_PORT);

    logger.info("###### Initialize server completed ######");
  } catch (error) {
    logger.error("###### Initialize server failed ######", error);

    process.exit(PROCESS_EXIT_CODE.ERROR);
  }
})();
