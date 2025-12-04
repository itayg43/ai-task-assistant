import http from "http";

import { connectPrismaClient, disconnectPrismaClient } from "@clients/prisma";
import {
  closeRedisClient,
  connectRedisClient,
  destroyRedisClient,
} from "@clients/redis";
import { env } from "@config/env";
import { createLogger } from "@shared/config/create-logger";
import { PROCESS_EXIT_CODE } from "@shared/constants";
import { registerProcessEventHandlers } from "@shared/utils/process-event/register-process-event-handlers";
import { startServer } from "@shared/utils/start-server";
import { app } from "./app";

const logger = createLogger("server");

(async () => {
  try {
    logger.info(`###### Initialize ${env.SERVICE_NAME} ######`);

    const server = http.createServer(app);

    await Promise.all([connectPrismaClient(), connectRedisClient()]);

    registerProcessEventHandlers(server, process.exit, {
      afterSuccess: async () => {
        await Promise.all([disconnectPrismaClient(), closeRedisClient()]);
      },
      afterFailure: async () => {
        await disconnectPrismaClient();
        destroyRedisClient();
      },
    });

    await startServer(server, env.SERVICE_PORT);

    logger.info(`###### Initialize ${env.SERVICE_NAME} completed ######`);
  } catch (error) {
    logger.error(`###### Initialize ${env.SERVICE_NAME} failed ######`, error);

    process.exit(PROCESS_EXIT_CODE.ERROR);
  }
})();
