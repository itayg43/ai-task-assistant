import type { TokenUsage } from "./token-usage";

export type RequestMetadata = {
  requestId: string;
  userId: number;
  tokenUsage: TokenUsage;
  startTime: number;
  serviceName: string;
  rateLimiterName: string;
};
