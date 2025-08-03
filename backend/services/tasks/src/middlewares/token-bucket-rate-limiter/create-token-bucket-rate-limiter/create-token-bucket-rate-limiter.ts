import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Redis from "ioredis";
import Redlock from "redlock";

import { createLogger } from "@config/logger";
import { TokenBucketRateLimiterServiceError } from "@errors";
import { TokenBucketRateLimiterConfig } from "@types";
import { getAuthenticationContext } from "@utils/authentication-context";
import { getTokenBucketLockKey } from "@utils/token-bucket/key-utils";
import { processTokenBucket } from "@utils/token-bucket/process-token-bucket";
import { withLock } from "@utils/with-lock";

const logger = createLogger("tokenBucketRateLimiter");

export const createTokenBucketRateLimiter =
  (
    redisClient: Redis,
    redlockClient: Redlock,
    config: TokenBucketRateLimiterConfig
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
            return await processTokenBucket(redisClient, config, userId);
          }
        );

        if (!result.allowed) {
          logger.warn(
            `Request from user ${userId} declined by rate limiter`,
            logContext
          );

          res.status(StatusCodes.TOO_MANY_REQUESTS).json({
            message: "Rate limit exceeded, please try again later.",
          });

          return;
        }

        logger.info(
          `Request from user ${userId} allowed by rate limiter`,
          logContext
        );

        next();
      } catch (error) {
        next(new TokenBucketRateLimiterServiceError());
      }
    } catch (error) {
      next(error);
    }
  };
