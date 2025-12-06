import { PrismaClient } from "@prisma/client";
// Re-export PrismaClient and Prisma namespace for centralized imports
export { Prisma, PrismaClient } from "@prisma/client";

import { createLogger } from "../config/create-logger";
import { DEFAULT_RETRY_CONFIG } from "../constants";
import { withRetry } from "../utils/with-retry";

const logger = createLogger("prisma");

export const createPrismaClient = (databaseUrl: string) => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  return prisma;
};

export const connectPrismaClient = async (prisma: PrismaClient) => {
  return await withRetry(
    DEFAULT_RETRY_CONFIG,
    async () => {
      logger.info("Connecting Prisma client...");
      await prisma.$connect();
      logger.info("Prisma client connected");
    },
    {
      operation: "prisma_connect",
    }
  );
};

export const disconnectPrismaClient = async (prisma: PrismaClient) => {
  try {
    logger.info("Disconnecting Prisma client...");

    await prisma.$disconnect();

    logger.info("Prisma client disconnected");
  } catch (error) {
    logger.error("Failed to disconnect Prisma client", error);

    throw error;
  }
};
