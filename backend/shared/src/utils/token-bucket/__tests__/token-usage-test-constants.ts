import type {
  TokenUsageRateLimiterConfig,
  TokenUsageState,
} from "../../../types";

export const mockTokenUsageConfig: TokenUsageRateLimiterConfig = {
  serviceName: "service",
  rateLimiterName: "test",
  windowTokensLimit: 1000,
  windowSizeSeconds: 86400, // 24 hours
  estimatedTokens: 100,
  lockTtlMs: 500,
} as const;

export const mockUserId = 1;

export const mockKey = "process:token:bucket";

export const mockLockKey = `${mockKey}:lock`;

export const mockWindowStartTimestamp = 1000000;

export const mockTokensUsed = 500;

export const mockRequestId = "test-request-id";

export const mockTokensReserved = mockTokenUsageConfig.estimatedTokens;

export const mockActualTokens = 150;

export const mockTokenUsageAllowedResponse: TokenUsageState = {
  allowed: true,
  tokensUsed: mockTokensReserved,
  tokensReserved: mockTokensReserved,
  tokensRemaining: mockTokenUsageConfig.windowTokensLimit - mockTokensReserved,
  windowStartTimestamp: mockWindowStartTimestamp,
};

export const mockTokenUsageDeniedResponse: TokenUsageState = {
  allowed: false,
  tokensUsed: 950,
  tokensReserved: 0,
  tokensRemaining: 50,
  windowStartTimestamp: mockWindowStartTimestamp,
};
