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
  // Check both fields are defined (Redis returns strings, not numbers)
  const bucketExists =
    bucket?.[TOKEN_BUCKET_FIELD_TOKENS] !== undefined &&
    bucket?.[TOKEN_BUCKET_FIELD_LAST] !== undefined;

  if (!bucketExists) {
    await redisClient.hset(
      key,
      TOKEN_BUCKET_FIELD_TOKENS,
      config.bucketSize,
      TOKEN_BUCKET_FIELD_LAST,
      timestamp
    );
  }

  return {
    tokens: bucketExists
      ? parseInt(bucket[TOKEN_BUCKET_FIELD_TOKENS], 10)
      : config.bucketSize,
    last: bucketExists
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
