import Redis from "ioredis";
import Redlock from "redlock";

import {
  deleteRequestMetadata,
  getRequestMetadata,
  reconcileTokenUsage,
} from "@services/token-usage-service";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("reconcileTokensIfPossible");

/**
 * Helper to reconcile token usage if metadata is available
 * Encapsulates the common pattern: fetch metadata → reconcile if exists → warn if not
 */
export const reconcileTokensIfPossible = async (
  redisClient: Redis,
  redlockClient: Redlock,
  requestId: string,
  actualTokens: number,
  lockTtlMs: number,
): Promise<void> => {
  const metadata = await getRequestMetadata(redisClient, requestId);

  if (metadata) {
    void reconcileTokenUsage(
      redisClient,
      redlockClient,
      requestId,
      metadata,
      actualTokens,
      lockTtlMs,
    ).then(() => {
      // Clean up metadata after reconciliation
      void deleteRequestMetadata(redisClient, requestId);
    });
  } else {
    // TODO: Add metric to track metadata expiration (tokens will leak in this edge case)
    // See README.md "Future Changes" section for details
    logger.warn("Cannot reconcile tokens: metadata not found", {
      requestId,
    });
  }
};
