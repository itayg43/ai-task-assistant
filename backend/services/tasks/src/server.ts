import { connectPrismaClient, disconnectPrismaClient } from "@clients/prisma";
import {
  closeRedisClient,
  connectRedisClient,
  destroyRedisClient,
} from "@clients/redis";
import { env } from "@config/env";
import { initializeServer } from "@shared/utils/server";
import { app } from "./app";

(async () => {
  await initializeServer(env.SERVICE_NAME, env.SERVICE_PORT, app, {
    startCallback: async () => {
      await Promise.all([connectPrismaClient(), connectRedisClient()]);
    },
    cleanupCallbacks: {
      afterSuccess: async () => {
        await Promise.all([disconnectPrismaClient(), closeRedisClient()]);
      },
      afterFailure: async () => {
        await disconnectPrismaClient();
        destroyRedisClient();
      },
    },
  });
})();
