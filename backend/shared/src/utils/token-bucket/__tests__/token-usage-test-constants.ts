export const mockTokenUsageConfig = {
  serviceName: "service",
  rateLimiterName: "test",
  windowTokensLimit: 1000,
  windowSizeSeconds: 86400, // 24 hours
  estimatedTokens: 100,
  lockTtlMs: 500,
} as const;

export const mockUserId = 1;
export const mockKey = "process:token:bucket";
export const mockWindowStartTimestamp = 1000000;
export const mockTokensUsed = 500;
