export type TokenBucketRateLimiterConfig = {
  serviceName: string;
  rateLimiterName: string;
  bucketSize: number;
  refillRate: number;
  bucketTtlSeconds: number;
  lockTtlMs: number;
};
