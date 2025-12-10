import { NextFunction, Request, Response } from "express";
import Redis from "ioredis";
import Redlock from "redlock";

import { createLogger } from "../../../config/create-logger";
import type { TokenUsageRateLimiterConfig } from "../../../types";
import { getAuthenticationContext } from "../../../utils/authentication-context";
import { getTokenBucketLockKey } from "../../../utils/token-bucket/key-utils";
import { updateTokenUsage as updateTokenUsageUtil } from "../../../utils/token-bucket/update-token-usage";
import { withLock } from "../../../utils/with-lock";

const logger = createLogger("updateTokenUsageMiddleware");

export const createUpdateTokenUsageMiddleware =
  (
    redisClient: Redis,
    redlockClient: Redlock,
    config: TokenUsageRateLimiterConfig
  ) =>
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only process if tokenUsage exists and actualTokens is set
      const tokenUsage = res.locals.tokenUsage;
      if (!tokenUsage || typeof tokenUsage.actualTokens !== "number") {
        next();

        return;
      }

      const { tokensReserved, windowStartTimestamp, actualTokens } = tokenUsage;
      const { userId } = getAuthenticationContext(res);

      const lockKey = getTokenBucketLockKey(
        config.serviceName,
        config.rateLimiterName,
        userId
      );

      // Update token usage asynchronously to not block the response
      setImmediate(async () => {
        try {
          await withLock(redlockClient, lockKey, config.lockTtlMs, async () => {
            return await updateTokenUsageUtil(
              redisClient,
              config,
              userId,
              actualTokens,
              tokensReserved,
              windowStartTimestamp
            );
          });
        } catch (error) {
          // Log error but don't fail the request
          logger.error(`Token usage update failed for user ${userId}`, error, {
            requestId: res.locals.requestId,
            actualTokens,
            tokensReserved,
          });
        }
      });

      next();
    } catch (error) {
      // Log error but don't fail the request
      logger.error("Token usage update middleware error", error, {
        requestId: res.locals.requestId,
      });

      next();
    }
  };
