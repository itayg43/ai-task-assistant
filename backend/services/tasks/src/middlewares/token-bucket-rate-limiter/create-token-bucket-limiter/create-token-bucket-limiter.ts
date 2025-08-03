import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createLogger } from "@config/logger";
import { TokenBucketRateLimiterConfig } from "@types";
import { getAuthenticationContext } from "@utils/authentication-context";
import { getTokenBucketLockKey } from "@utils/token-bucket/key-utils";
import { processTokenBucket } from "@utils/token-bucket/process-token-bucket";
import { withLock } from "@utils/with-lock";

const logger = createLogger("tokenBucketRateLimiter");

export const createTokenBucketLimiter =
  (config: TokenBucketRateLimiterConfig) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // May throw AuthenticationError
      const { userId } = getAuthenticationContext(res);

      const lockKey = getTokenBucketLockKey(
        `${config.serviceName}:${config.rateLimiterName}`,
        userId
      );

      const logContext = {
        rateLimiterName: config.rateLimiterName,
        method: req.method,
        originalUrl: req.originalUrl,
      };

      try {
        const result = await withLock(lockKey, config.lockTtlMs, async () => {
          return await processTokenBucket(userId, config);
        });

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
        logger.error(
          `Error during rate limiting for user ${userId}`,
          error,
          logContext
        );

        res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
          message: "Unexpected error occurred, please try again later.",
        });
      }
    } catch (error) {
      // Pass AuthenticationError to error handler
      next(error);
    }
  };
