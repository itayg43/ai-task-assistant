import Redis from "ioredis";
import Redlock from "redlock";

import { createLogger } from "@shared/config/create-logger";
import { getTokenBucketLockKey } from "@shared/utils/token-bucket/key-utils";
import { updateTokenUsage } from "@shared/utils/token-bucket/update-token-usage";
import { withLock } from "@shared/utils/with-lock";

import { getRequestMetadata, getRequestMetadataKey } from "./request-metadata";

const logger = createLogger("reconcileTokenUsageFromCallback");

export const reconcileTokenUsageFromCallback = async (
  redisClient: Redis,
  redlockClient: Redlock,
  requestId: string,
  actualTokens: number,
  lockTtlMs: number
): Promise<number | null> => {
  const metadata = await getRequestMetadata(redisClient, requestId);

  if (!metadata) {
    logger.warn("Cannot reconcile token usage: metadata not found", {
      requestId,
    });
    return null;
  }

  const { userId, tokensReserved, windowStartTimestamp, startTime, serviceName, rateLimiterName } =
    metadata;

  const lockKey = getTokenBucketLockKey(serviceName, rateLimiterName, userId);

  await withLock(
    redlockClient,
    lockKey,
    lockTtlMs,
    async () => {
      await updateTokenUsage(
        redisClient,
        serviceName,
        rateLimiterName,
        userId,
        actualTokens,
        tokensReserved,
        windowStartTimestamp
      );
    },
    {
      requestId,
      operation: "reconcileTokenUsageFromCallback",
    }
  );

  // Clean up metadata after reconciliation
  const metadataKey = getRequestMetadataKey(requestId);
  await redisClient.del(metadataKey);

  logger.debug("Token usage reconciled successfully", {
    requestId,
    userId,
    actualTokens,
    tokensReserved,
    startTime,
  });

  return startTime;
};
