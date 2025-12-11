import type { TokenBucketRateLimiterConfig } from "../../../types";

export const mockTokenBucketConfig: TokenBucketRateLimiterConfig = {
  serviceName: "service",
  rateLimiterName: "test",
  bucketSize: 100,
  refillRate: 1,
  bucketTtlSeconds: 100,
  lockTtlMs: 500,
} as const;

export const mockTokenBucketKey = "token:bucket:state";

export const mockProcessTokenBucketKey = "process:token:bucket";

export const mockTokens = 50;

export const mockTimestamp = 0;
