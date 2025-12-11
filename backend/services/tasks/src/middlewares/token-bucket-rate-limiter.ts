import { redis } from "@clients/redis";
import { redlock } from "@clients/redlock";
import { env } from "@config/env";
import { createTokenBucketRateLimiter } from "@shared/middlewares/token-bucket-rate-limiter/create-token-bucket-rate-limiter";

export const tokenBucketRateLimiter = {
  api: createTokenBucketRateLimiter(redis, redlock, {
    serviceName: env.SERVICE_NAME,
    rateLimiterName: env.API_TOKEN_BUCKET_RATE_LIMITER_NAME,
    bucketSize: env.API_TOKEN_BUCKET_RATE_LIMITER_BUCKET_SIZE,
    refillRate: env.API_TOKEN_BUCKET_RATE_LIMITER_REFILL_RATE,
    bucketTtlSeconds: env.API_TOKEN_BUCKET_RATE_LIMITER_BUCKET_TTL_SECONDS,
    lockTtlMs: env.API_TOKEN_BUCKET_RATE_LIMITER_LOCK_TTL_MS,
  }),
} as const;
