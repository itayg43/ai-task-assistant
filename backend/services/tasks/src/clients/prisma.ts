import { env } from "@config/env";
import {
  connectPrismaClient as connect,
  createPrismaClient,
  disconnectPrismaClient as disconnect,
} from "@shared/clients/prisma";

export const prisma = createPrismaClient(env.DATABASE_URL);

export const connectPrismaClient = async () => await connect(prisma);

export const disconnectPrismaClient = async () => await disconnect(prisma);
