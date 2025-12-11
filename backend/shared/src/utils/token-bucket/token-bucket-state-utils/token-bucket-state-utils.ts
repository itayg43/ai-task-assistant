import Redis from "ioredis";

import {
  TOKEN_USAGE_FIELD_TOKENS_USED,
  TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP,
} from "../../../constants";
import { TokenBucketRateLimiterConfig } from "../../../types";

export const getTokenBucketState = async (
  redisClient: Redis,
  key: string,
  config: TokenBucketRateLimiterConfig,
  timestamp: number
) => {
  const bucket = await redisClient.hgetall(key);

  return {
    tokens: bucket?.tokens ? parseInt(bucket.tokens, 10) : config.bucketSize,
    last: bucket?.last ? parseInt(bucket.last, 10) : timestamp,
  };
};

export const setTokenBucketState = async (
  redisClient: Redis,
  key: string,
  config: TokenBucketRateLimiterConfig,
  tokens: number,
  timestamp: number
) => {
  await Promise.all([
    redisClient.hset(key, "tokens", tokens, "last", timestamp),
    redisClient.expire(key, config.bucketTtlSeconds),
  ]);
};

export const getTokenUsageState = async (
  redisClient: Redis,
  key: string,
  defaultWindowStartTimestamp: number
) => {
  const state = await redisClient.hgetall(key);

  return {
    tokensUsed: state?.[TOKEN_USAGE_FIELD_TOKENS_USED]
      ? parseInt(state[TOKEN_USAGE_FIELD_TOKENS_USED], 10)
      : 0,
    windowStartTimestamp: state?.[TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP]
      ? parseInt(state[TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP], 10)
      : defaultWindowStartTimestamp,
  };
};

export const resetTokenUsageWindow = async (
  redisClient: Redis,
  key: string,
  newWindowStartTimestamp: number,
  ttlSeconds: number
) => {
  await Promise.all([
    redisClient.hset(
      key,
      TOKEN_USAGE_FIELD_TOKENS_USED,
      0,
      TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP,
      newWindowStartTimestamp
    ),
    redisClient.expire(key, ttlSeconds),
  ]);
};

export const incrementTokenUsage = async (
  redisClient: Redis,
  key: string,
  amount: number
): Promise<number> => {
  return await redisClient.hincrby(key, TOKEN_USAGE_FIELD_TOKENS_USED, amount);
};

export const decrementTokenUsage = async (
  redisClient: Redis,
  key: string,
  amount: number
): Promise<number> => {
  return await redisClient.hincrby(key, TOKEN_USAGE_FIELD_TOKENS_USED, -amount);
};
