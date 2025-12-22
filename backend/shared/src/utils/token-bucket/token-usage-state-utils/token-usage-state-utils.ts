import Redis from "ioredis";

import {
  MS_PER_SECOND,
  TOKEN_USAGE_FIELD_TOKENS_USED,
  TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP,
} from "../../../constants";
import { decrementHashField, incrementHashField } from "../../redis";

export const getTokenUsageState = async (
  redisClient: Redis,
  key: string,
  defaultWindowStartTimestamp: number
) => {
  const state = await redisClient.hgetall(key);
  // Check both fields are defined (Redis returns strings, not numbers)
  const stateExists =
    state?.[TOKEN_USAGE_FIELD_TOKENS_USED] !== undefined &&
    state?.[TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP] !== undefined;

  if (!stateExists) {
    await redisClient.hset(
      key,
      TOKEN_USAGE_FIELD_TOKENS_USED,
      0,
      TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP,
      defaultWindowStartTimestamp
    );
  }

  return {
    tokensUsed: stateExists
      ? parseInt(state[TOKEN_USAGE_FIELD_TOKENS_USED], 10)
      : 0,
    windowStartTimestamp: stateExists
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
  return await incrementHashField(
    redisClient,
    key,
    TOKEN_USAGE_FIELD_TOKENS_USED,
    amount
  );
};

export const decrementTokenUsage = async (
  redisClient: Redis,
  key: string,
  amount: number
): Promise<number> => {
  return await decrementHashField(
    redisClient,
    key,
    TOKEN_USAGE_FIELD_TOKENS_USED,
    amount
  );
};

export const ensureTokenUsageWindowTtl = async (
  redisClient: Redis,
  key: string,
  windowStartTimestamp: number,
  windowSizeSeconds: number,
  currentTime: number
): Promise<void> => {
  const ttl = await redisClient.ttl(key);

  // Only set TTL if key has no expiration (ttl === -1)
  if (ttl === -1) {
    // Calculate TTL: time remaining until window end
    const windowSizeMs = windowSizeSeconds * MS_PER_SECOND;
    const windowEndMs = windowStartTimestamp + windowSizeMs;
    const ttlSeconds = Math.ceil((windowEndMs - currentTime) / MS_PER_SECOND);

    await redisClient.expire(key, ttlSeconds);
  }
};
