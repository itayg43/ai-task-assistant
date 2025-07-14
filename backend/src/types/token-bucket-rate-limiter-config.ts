export type TokenBucketRateLimiterConfig = {
  bucketSize: number;
  refillRate: number;
  bucketTtlSeconds: number;
  lockTtlMs: number;
  redisKeyPrefix: string;
};
