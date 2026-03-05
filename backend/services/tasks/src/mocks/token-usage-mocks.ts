import { mockUserId } from "@mocks/tasks-mocks";
import type { RequestMetadata } from "@shared/types";

export const mockTokenUsageRequestId = "test-request-id";
export const mockActualTokens = 450;
export const mockLockTtlMs = 5000;

export const mockRequestMetadata: RequestMetadata = {
  requestId: mockTokenUsageRequestId,
  userId: mockUserId,
  tokenUsage: {
    reserved: 500,
    windowStart: 1234567890000,
  },
  startTime: 1234567890000,
  serviceName: "tasks",
  rateLimiterName: "openai-token-usage",
};
