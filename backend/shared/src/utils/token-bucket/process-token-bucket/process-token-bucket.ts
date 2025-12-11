import Redis from "ioredis";

import { createLogger } from "../../../config/create-logger";
import {
  MS_PER_SECOND,
  TOKEN_CONSUMPTION_PER_REQUEST,
} from "../../../constants";
import { TokenBucketRateLimiterConfig, TokenBucketState } from "../../../types";
import { getCurrentTime } from "../../date-time";
import { getTokenBucketKey } from "../key-utils";
import {
  decrementTokenBucket,
  getTokenBucketState,
  incrementTokenBucket,
  updateTokenBucketTimestamp,
} from "../token-bucket-state-utils";

const logger = createLogger("processTokenBucket");

export const processTokenBucket = async (
  redisClient: Redis,
  config: TokenBucketRateLimiterConfig,
  userId: number
): Promise<TokenBucketState> => {
  const key = getTokenBucketKey(
    config.serviceName,
    config.rateLimiterName,
    userId
  );

  const now = getCurrentTime();

  const { tokens, last } = await getTokenBucketState(
    redisClient,
    key,
    config,
    now
  );

  const elapsed = (now - last) / MS_PER_SECOND;
  // Note: There's a potential race condition between reading state and incrementing tokens.
  // However, this function is called within a distributed lock (Redlock) at the middleware level,
  // which ensures atomicity across multiple service instances. The lock prevents concurrent
  // modifications to the token bucket state during the refill and consumption operations.
  const tokensToAdd = Math.floor(elapsed * config.refillRate);
  const actualIncrement = Math.min(
    tokensToAdd,
    Math.max(0, config.bucketSize - tokens)
  );

  const currentTokens =
    actualIncrement > 0
      ? await incrementTokenBucket(redisClient, key, actualIncrement)
      : tokens;

  logger.info(`Token bucket state before processing for user ${userId}`, {
    prevTokens: tokens,
    tokensToAdd,
    tokensAfterRefill: currentTokens,
    elapsedSec: parseFloat(elapsed.toFixed(2)),
  });

  if (currentTokens < 1) {
    logger.warn(
      `Token bucket denied request for user ${userId}: not enough tokens`
    );

    await updateTokenBucketTimestamp(
      redisClient,
      key,
      now,
      config.bucketTtlSeconds
    );

    return {
      allowed: false,
      tokensLeft: 0,
    };
  }

  const tokensLeft = await decrementTokenBucket(
    redisClient,
    key,
    TOKEN_CONSUMPTION_PER_REQUEST
  );

  await updateTokenBucketTimestamp(
    redisClient,
    key,
    now,
    config.bucketTtlSeconds
  );

  logger.info(`Token bucket allowed request for user ${userId}`, {
    tokensLeft,
  });

  return {
    allowed: true,
    tokensLeft,
  };
};
