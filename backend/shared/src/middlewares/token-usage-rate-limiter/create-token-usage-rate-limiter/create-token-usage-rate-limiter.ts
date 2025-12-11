import { NextFunction, Request, Response } from "express";
import Redis from "ioredis";
import Redlock from "redlock";

import { createLogger } from "../../../config/create-logger";
import {
  BaseError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../../../errors";
import type { TokenUsageRateLimiterConfig } from "../../../types";
import { getAuthenticationContext } from "../../../utils/authentication-context";
import { getTokenBucketLockKey } from "../../../utils/token-bucket/key-utils";
import { processTokenUsage } from "../../../utils/token-bucket/process-token-usage";
import { withLock } from "../../../utils/with-lock";

const logger = createLogger("tokenUsageRateLimiter");

export const createTokenUsageRateLimiter =
  (
    redisClient: Redis,
    redlockClient: Redlock,
    config: TokenUsageRateLimiterConfig
  ) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = getAuthenticationContext(res);

      const lockKey = getTokenBucketLockKey(
        config.serviceName,
        config.rateLimiterName,
        userId
      );

      const logContext = {
        requestId: res.locals.requestId,
        rateLimiterName: config.rateLimiterName,
        method: req.method,
        originalUrl: req.originalUrl,
      };

      try {
        const result = await withLock(
          redlockClient,
          lockKey,
          config.lockTtlMs,
          async () => {
            return await processTokenUsage(redisClient, config, userId);
          }
        );

        if (!result.allowed) {
          logger.warn(
            `Request from user ${userId} declined by token usage rate limiter`,
            logContext
          );

          throw new TooManyRequestsError();
        }

        // Store reservation data for later use by update middleware
        res.locals.tokenUsage = {
          tokensReserved: result.tokensReserved,
          windowStartTimestamp: result.windowStartTimestamp,
          // actualTokens will be set by the controller after AI call
        };

        logger.info(
          `Request from user ${userId} allowed by token usage rate limiter`,
          {
            ...logContext,
            tokensReserved: result.tokensReserved,
            tokensRemaining: result.tokensRemaining,
          }
        );

        next();
      } catch (error) {
        if (error instanceof BaseError) {
          next(error);
        } else {
          next(new ServiceUnavailableError());
        }
      }
    } catch (error) {
      next(error);
    }
  };
