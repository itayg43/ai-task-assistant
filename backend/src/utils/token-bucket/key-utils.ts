export const getTokenBucketKey = (keyPrefix: string, userId: number) => {
  return `process:token:bucket:${keyPrefix}:${userId}`;
};

export const getTokenBucketLockKey = (keyPrefix: string, userId: number) => {
  return `process:token:bucket:${keyPrefix}:${userId}:lock`;
};
