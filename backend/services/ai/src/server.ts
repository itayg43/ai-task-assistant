import http from "http";

import { createLogger } from "@shared/config/create-logger";
import { PROCESS_EXIT_CODE } from "@shared/constants";
import { registerProcessEventHandlers } from "@shared/utils/process-event/register-process-event-handlers";
import { startServer } from "@shared/utils/start-server";
import { app } from "./app";
import { env } from "./env";

const logger = createLogger("server");

(async () => {
  try {
    logger.info(`###### Initialize ${env.SERVICE_NAME} ######`);

    const server = http.createServer(app);

    registerProcessEventHandlers(server, process.exit, {
      afterSuccess: async () => {},
      afterFailure: () => {},
    });

    await startServer(server, env.SERVICE_PORT);

    logger.info(`###### Initialize ${env.SERVICE_NAME} completed ######`);
  } catch (error) {
    logger.error(`###### Initialize ${env.SERVICE_NAME} failed ######`, error);

    process.exit(PROCESS_EXIT_CODE.ERROR);
  }
})();
