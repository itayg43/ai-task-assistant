export type TokenBucketRateLimiterConfig = {
  bucketSize: number;
  refillRate: number;
  bucketTtlSeconds: number;
  lockTtlMs: number;
  keyPrefix: string;
};
