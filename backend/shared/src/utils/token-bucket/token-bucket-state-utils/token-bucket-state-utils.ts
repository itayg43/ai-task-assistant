import Redis from "ioredis";

import {
  TOKEN_BUCKET_FIELD_LAST,
  TOKEN_BUCKET_FIELD_TOKENS,
} from "../../../constants";
import { TokenBucketRateLimiterConfig } from "../../../types";
import { decrementHashField, incrementHashField } from "../../redis";

export const getTokenBucketState = async (
  redisClient: Redis,
  key: string,
  config: TokenBucketRateLimiterConfig,
  timestamp: number
) => {
  const bucket = await redisClient.hgetall(key);
  const tokensFieldExists = bucket?.[TOKEN_BUCKET_FIELD_TOKENS] !== undefined;

  // If the tokens field doesn't exist, initialize both tokens and last fields atomically
  // This ensures both fields always exist in Redis, preventing issues when decrementing
  if (!tokensFieldExists) {
    await redisClient.hset(
      key,
      TOKEN_BUCKET_FIELD_TOKENS,
      config.bucketSize,
      TOKEN_BUCKET_FIELD_LAST,
      timestamp
    );
  }

  return {
    tokens: tokensFieldExists
      ? parseInt(bucket[TOKEN_BUCKET_FIELD_TOKENS], 10)
      : config.bucketSize,
    last:
      tokensFieldExists && bucket?.[TOKEN_BUCKET_FIELD_LAST]
        ? parseInt(bucket[TOKEN_BUCKET_FIELD_LAST], 10)
        : timestamp,
  };
};

export const incrementTokenBucket = async (
  redisClient: Redis,
  key: string,
  amount: number
): Promise<number> => {
  return await incrementHashField(
    redisClient,
    key,
    TOKEN_BUCKET_FIELD_TOKENS,
    amount
  );
};

export const decrementTokenBucket = async (
  redisClient: Redis,
  key: string,
  amount: number
): Promise<number> => {
  return await decrementHashField(
    redisClient,
    key,
    TOKEN_BUCKET_FIELD_TOKENS,
    amount
  );
};

export const updateTokenBucketTimestamp = async (
  redisClient: Redis,
  key: string,
  timestamp: number,
  ttlSeconds: number
): Promise<void> => {
  await Promise.all([
    redisClient.hset(key, TOKEN_BUCKET_FIELD_LAST, timestamp),
    redisClient.expire(key, ttlSeconds),
  ]);
};
