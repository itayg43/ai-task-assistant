import { vi } from "vitest";

export const createMiddlewareMock = () => {
  return vi.fn((_req, _res, next) => next());
};

export const createRateLimiterMocks = () => ({
  mockTokenBucketRateLimiter: createMiddlewareMock(),
  mockOpenaiTokenUsageRateLimiter: createMiddlewareMock(),
  mockOpenaiUpdateTokenUsage: createMiddlewareMock(),
});
