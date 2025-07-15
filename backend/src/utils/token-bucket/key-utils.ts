import { PROCESS_TOKEN_BUCKET_REDIS_KEY_PREFIX } from "@constants";

export const getTokenBucketKey = (keyPrefix: string, userId: number) => {
  return `${PROCESS_TOKEN_BUCKET_REDIS_KEY_PREFIX}:${keyPrefix}:${userId}`;
};

export const getTokenBucketLockKey = (keyPrefix: string, userId: number) => {
  return `${PROCESS_TOKEN_BUCKET_REDIS_KEY_PREFIX}:${keyPrefix}:${userId}:lock`;
};
