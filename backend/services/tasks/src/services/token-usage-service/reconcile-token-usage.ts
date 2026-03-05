import Redis from "ioredis";
import Redlock from "redlock";

import { createLogger } from "@shared/config/create-logger";
import type { RequestMetadata } from "@shared/types";
import { getTokenBucketLockKey } from "@shared/utils/token-bucket/key-utils";
import { updateTokenUsage } from "@shared/utils/token-bucket/update-token-usage";
import { withLock } from "@shared/utils/with-lock";

const logger = createLogger("reconcileTokenUsage");

export const reconcileTokenUsage = async (
  redisClient: Redis,
  redlockClient: Redlock,
  metadata: RequestMetadata,
  actualTokens: number,
  lockTtlMs: number,
): Promise<void> => {
  try {
    const {
      requestId,
      userId,
      tokenUsage: { reserved, windowStart },
      serviceName,
      rateLimiterName,
    } = metadata;

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
          reserved,
          windowStart,
        );
      },
      {
        requestId,
        operation: "reconcileTokenUsage",
      },
    );

    logger.debug("Token usage reconciled successfully", {
      requestId,
      metadata,
      actualTokens,
    });
  } catch (error) {
    // Error already logged by withLock, but catch here to prevent unhandled rejection
    // when called with fire-and-forget pattern (void reconcileTokenUsage(...))
    logger.error("Token usage reconciliation failed", error, {
      requestId: metadata.requestId,
      metadata,
      actualTokens,
    });
  }
};
