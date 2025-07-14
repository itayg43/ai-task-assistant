import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createLogger } from "@config";
import { TAG } from "@constants";
import { TokenBucketRateLimiterConfig } from "@types";
import { getTokenBucketLockKey, processTokenBucket, withLock } from "@utils";

const logger = createLogger(TAG.TOKEN_BUCKET_RATE_LIMITER);

export const tokenBucketRateLimiter = {
  global: createTokenBucketLimiter({
    bucketSize: 100,
    refillRate: 1,
    // set to twice the time it would take to refill the bucket from empty to full
    bucketTtlSeconds: (2 * 100) / 1,
    lockTtlMs: 500,
    keyPrefix: "global",
  }),
} as const;

function createTokenBucketLimiter(config: TokenBucketRateLimiterConfig) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userId = 1;
    const lockKey = getTokenBucketLockKey(config.keyPrefix, userId);

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
        {
          error,
        }
      );

      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        message: "Please try again later.",
      });
    }
  };
}
