import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createLogger, env } from "@config";
import { TAG } from "@constants";
import { TokenBucketRateLimiterConfig } from "@types";
import { getTokenBucketLockKey, processTokenBucket, withLock } from "@utils";

const logger = createLogger(TAG.TOKEN_BUCKET_RATE_LIMITER);

export const tokenBucketRateLimiter = {
  global: createTokenBucketLimiter({
    bucketSize: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_SIZE,
    refillRate: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_REFILL_RATE,
    bucketTtlSeconds: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_TTL_SECONDS,
    lockTtlMs: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_LOCK_TTL_MS,
    redisKeyPrefix: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_REDIS_KEY_PREFIX,
  }),
} as const;

function createTokenBucketLimiter(config: TokenBucketRateLimiterConfig) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userId = 1;
    const lockKey = getTokenBucketLockKey(config.redisKeyPrefix, userId);

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
