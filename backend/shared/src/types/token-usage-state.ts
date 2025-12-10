export type TokenUsageState = {
  allowed: boolean;
  tokensUsed: number;
  tokensReserved: number;
  tokensRemaining: number;
  windowStartTimestamp: number;
};
