import { redis } from "@clients/redis";
import { redlock } from "@clients/redlock";
import { env } from "@config/env";
import { createTokenBucketLimiter } from "@middlewares/token-bucket-rate-limiter/create-token-bucket-limiter";

export const tokenBucketRateLimiter = {
  global: createTokenBucketLimiter(redis, redlock, {
    serviceName: env.SERVICE_NAME,
    rateLimiterName: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_NAME,
    bucketSize: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_SIZE,
    refillRate: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_REFILL_RATE,
    bucketTtlSeconds: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_TTL_SECONDS,
    lockTtlMs: env.GLOBAL_TOKEN_BUCKET_RATE_LIMITER_LOCK_TTL_MS,
  }),
} as const;
