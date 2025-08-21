import { RetryConfig } from "../types";

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
} as const;
