import { PrismaClient } from "@prisma/client";

import { createLogger } from "../config/create-logger";

// Re-export PrismaClient and Prisma namespace for centralized imports
export { Prisma, PrismaClient } from "@prisma/client";

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

export const connectPrismaClient = async (
  prisma: PrismaClient
): Promise<void> => {
  try {
    logger.info("Connecting Prisma client...");
    await prisma.$connect();
    logger.info("Prisma client connected");
  } catch (error) {
    logger.error("Failed to connect Prisma client", error);

    throw error;
  }
};

export const disconnectPrismaClient = async (
  prisma: PrismaClient
): Promise<void> => {
  try {
    logger.info("Disconnecting Prisma client...");
    await prisma.$disconnect();
    logger.info("Prisma client disconnected");
  } catch (error) {
    logger.error("Failed to disconnect Prisma client", error);

    throw error;
  }
};
