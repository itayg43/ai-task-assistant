export type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  backoffMultiplier: number;
};
