export type TokenUsageRateLimiterConfig = {
  serviceName: string;
  rateLimiterName: string;
  windowTokensLimit: number;
  windowSizeSeconds: number;
  estimatedTokens: number;
  lockTtlMs: number;
};
