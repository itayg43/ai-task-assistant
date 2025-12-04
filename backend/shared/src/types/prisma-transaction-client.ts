import { PrismaClient } from "@prisma/client";

/**
 * Type representing a Prisma transaction client.
 * This is the type returned by Prisma's $transaction callback.
 * It omits methods that are not available in transaction context.
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
