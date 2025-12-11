import { redis } from "@clients/redis";
import { redlock } from "@clients/redlock";
import { env } from "@config/env";
import { createTokenUsageRateLimiter } from "@shared/middlewares/token-usage-rate-limiter/create-token-usage-rate-limiter";
import { createUpdateTokenUsageMiddleware } from "@shared/middlewares/token-usage-rate-limiter/update-token-usage";
import type { TokenUsageRateLimiterConfig } from "@shared/types";

const baseOpenaiTokenUsageRateLimiterConfig: Omit<
  TokenUsageRateLimiterConfig,
  "estimatedTokens"
> = {
  serviceName: env.SERVICE_NAME,
  rateLimiterName: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_NAME,
  windowTokensLimit: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_WINDOW_TOKENS_LIMIT,
  windowSizeSeconds: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_WINDOW_SIZE_SECONDS,
  lockTtlMs: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
};

const createTaskTokenUsageRateLimiterConfig: TokenUsageRateLimiterConfig = {
  ...baseOpenaiTokenUsageRateLimiterConfig,
  estimatedTokens: env.CREATE_TASK_ESTIMATED_TOKEN_USAGE,
};

export const openaiTokenUsageRateLimiter = {
  createTask: createTokenUsageRateLimiter(
    redis,
    redlock,
    createTaskTokenUsageRateLimiterConfig
  ),
} as const;

export const openaiUpdateTokenUsage = createUpdateTokenUsageMiddleware(
  redis,
  redlock,
  env.SERVICE_NAME,
  env.OPENAI_TOKEN_USAGE_RATE_LIMITER_NAME,
  env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS
);
