import Redis from "ioredis";

import { TokenBucketRateLimiterConfig } from "../../../types";

export const getTokenBucketState = async (
  redisClient: Redis,
  key: string,
  config: TokenBucketRateLimiterConfig,
  timestamp: number
) => {
  const bucket = await redisClient.hgetall(key);

  return {
    tokens: bucket?.tokens ? parseFloat(bucket.tokens) : config.bucketSize,
    last: bucket?.last ? parseInt(bucket.last) : timestamp,
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
    redisClient.hmset(key, "tokens", tokens, "last", timestamp),
    redisClient.expire(key, config.bucketTtlSeconds),
  ]);
};
