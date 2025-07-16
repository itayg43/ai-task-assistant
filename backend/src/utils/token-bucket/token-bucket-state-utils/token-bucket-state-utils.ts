import { redis } from "@clients/redis";
import { TokenBucketRateLimiterConfig } from "@types";

export const getTokenBucketState = async (
  key: string,
  config: TokenBucketRateLimiterConfig,
  timestamp: number
) => {
  const bucket = await redis.hgetall(key);

  return {
    tokens: bucket?.tokens ? parseFloat(bucket.tokens) : config.bucketSize,
    last: bucket?.last ? parseInt(bucket.last) : timestamp,
  };
};

export const setTokenBucketState = async (
  key: string,
  config: TokenBucketRateLimiterConfig,
  tokens: number,
  timestamp: number
) => {
  await Promise.all([
    redis.hmset(key, "tokens", tokens, "last", timestamp),
    redis.expire(key, config.bucketTtlSeconds),
  ]);
};
