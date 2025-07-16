import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createLogger } from "@config/logger";
import { TokenBucketRateLimiterConfig } from "@types";
import { getTokenBucketLockKey } from "@utils/token-bucket/key-utils";
import { processTokenBucket } from "@utils/token-bucket/process-token-bucket";
import { withLock } from "@utils/with-lock";

const logger = createLogger("tokenBucketRateLimiter");

export const createTokenBucketLimiter =
  (config: TokenBucketRateLimiterConfig) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = 1;
    const lockKey = getTokenBucketLockKey(config.rateLimiterName, userId);

    try {
      const result = await withLock(lockKey, config.lockTtlMs, async () => {
        return await processTokenBucket(userId, config);
      });

      if (!result.allowed) {
        logger.warn(
          `Responding 429 Too Many Requests to user ${userId} for ${req.method} ${req.originalUrl}`
        );

        res.status(StatusCodes.TOO_MANY_REQUESTS).json({
          message: "Please try again later.",
        });

        return;
      }

      logger.info(
        `Request from user ${userId} to ${req.method} ${req.originalUrl} allowed by rate limiter`
      );

      next();
    } catch (error) {
      logger.error(
        `Error during rate limiting for user ${userId} on ${req.method} ${req.originalUrl}`,
        error
      );

      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        message: "Please try again later.",
      });
    }
  };
