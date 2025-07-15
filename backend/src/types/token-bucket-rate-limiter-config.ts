export type TokenBucketRateLimiterConfig = {
  rateLimiterName: string;
  bucketSize: number;
  refillRate: number;
  bucketTtlSeconds: number;
  lockTtlMs: number;
};
