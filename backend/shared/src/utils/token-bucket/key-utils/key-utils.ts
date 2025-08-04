import { PROCESS_TOKEN_BUCKET_REDIS_KEY_PREFIX } from "../../../constants";

export const getTokenBucketKey = (
  serviceName: string,
  rateLimiterName: string,
  userId: number
) => {
  return `${PROCESS_TOKEN_BUCKET_REDIS_KEY_PREFIX}:${serviceName}:${rateLimiterName}:${userId}`;
};

export const getTokenBucketLockKey = (
  serviceName: string,
  rateLimiterName: string,
  userId: number
) => {
  const key = getTokenBucketKey(serviceName, rateLimiterName, userId);

  return `${key}:lock`;
};
