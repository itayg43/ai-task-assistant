import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { MS_PER_SECOND } from "@constants";
import { TokenBucketRateLimiterConfig } from "@types";
import {
  getTokenBucketKey,
  getTokenBucketState,
  processTokenBucket,
  setTokenBucketState,
} from "@utils/token-bucket";

vi.mock("@utils/token-bucket/key-utils", () => ({
  getTokenBucketKey: vi.fn(),
}));

vi.mock(
  "@utils/token-bucket/token-bucket-state-utils/token-bucket-state-utils",
  () => ({
    getTokenBucketState: vi.fn(),
    setTokenBucketState: vi.fn(),
  })
);

/**
 * - Separate test for multiple sequential requests.
 * - Table-driven tests for processTokenBucket scenarios.
 *  */

describe("processTokenBucket", () => {
  const mockUserId = 1;
  const mockConfig: TokenBucketRateLimiterConfig = {
    rateLimiterName: "test",
    bucketSize: 100,
    refillRate: 1,
    bucketTtlSeconds: 100,
    lockTtlMs: 500,
  };
  const mockKey = "process:token:bucket";

  const cases = [
    {
      description: "should handle first time access - no existing state",
      mockNow: 1000,
      mockTokens: mockConfig.bucketSize,
      mockLast: 1000,
      expectedAllowed: true,
    },
    {
      description: "should handle sufficient tokens",
      mockNow: 1200,
      mockTokens: 50,
      mockLast: 1000,
      expectedAllowed: true,
    },
    {
      description: "should handle insufficient tokens",
      mockNow: 1200,
      mockTokens: 0,
      mockLast: 1000,
      expectedAllowed: false,
    },
    {
      description: "should handle token refill over time",
      mockNow: 2000,
      mockTokens: 0,
      mockLast: 1000,
      expectedAllowed: true,
      // Scenario:
      // User had 0 tokens, enough time has passed for at least 1 token to refill, so the request should be allowed.
      // Explanation:
      // Elapsed: (2000 - 1000) / 1000 = 1s
      // Tokens to add: 1 * refillRate = 1
      // Updated tokens: 0 + 1 = 1
      // After request: 1 - 1 = 0
    },
    {
      description: "should handle token cap (bucket size)",
      mockNow: 101000,
      mockTokens: 99,
      mockLast: 1000,
      expectedAllowed: true,
      // Scenario:
      // User has nearly full bucket, a long time passes, but tokens should not exceed the bucket size.
      // Explanation:
      // Elapsed: (101000 - 1000) / 1000 = 100s
      // Tokens to add: 100 * refillRate = 100
      // Updated tokens: 99 + 100 = 199, but bucket size is 100, so capped at 100
      // After request: 100 - 1 = 99
    },
  ] as const;

  const calculateExpectedTokensLeft = (
    expectedAllowed: boolean,
    mockTokens: number,
    mockNow: number,
    mockLast: number
  ) => {
    const elapsed = (mockNow - mockLast) / MS_PER_SECOND;
    const tokensToAdd = elapsed * mockConfig.refillRate;
    const updatedTokens = Math.min(
      mockTokens + tokensToAdd,
      mockConfig.bucketSize
    );

    return expectedAllowed ? updatedTokens - 1 : updatedTokens;
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // Separate test for multiple sequential requests
  it("should handle multiple sequential requests", async () => {
    // Scenario:
    // Multiple requests in quick succession, tokens should decrement each time, and eventually be denied when tokens run out.
    const mockNow = 1000;
    const mockTokens = 2;
    const mockLast = 1000;

    vi.setSystemTime(mockNow);

    (getTokenBucketKey as Mock).mockReturnValue(mockKey);
    (getTokenBucketState as Mock).mockResolvedValue({
      tokens: mockTokens,
      last: mockLast,
    });

    // First request: allowed, tokens = 1
    let result = await processTokenBucket(mockUserId, mockConfig);
    expect(result.allowed).toBe(true);
    expect(result.tokensLeft).toBeCloseTo(1);

    // Second request: allowed, tokens = 0
    (getTokenBucketState as Mock).mockResolvedValue({
      tokens: 1,
      last: mockNow,
    });
    result = await processTokenBucket(mockUserId, mockConfig);
    expect(result.allowed).toBe(true);
    expect(result.tokensLeft).toBeCloseTo(0);

    // Third request: denied, tokens = 0
    (getTokenBucketState as Mock).mockResolvedValue({
      tokens: 0,
      last: mockNow,
    });
    result = await processTokenBucket(mockUserId, mockConfig);
    expect(result.allowed).toBe(false);
    expect(result.tokensLeft).toBeCloseTo(0);
  });

  // Table-driven tests for various token bucket scenarios
  it.each(cases)(
    "$description",
    async ({ mockNow, mockTokens, mockLast, expectedAllowed }) => {
      const expectedTokensLeft = calculateExpectedTokensLeft(
        expectedAllowed,
        mockTokens,
        mockNow,
        mockLast
      );

      vi.setSystemTime(mockNow);

      (getTokenBucketKey as Mock).mockReturnValue(mockKey);
      (getTokenBucketState as Mock).mockResolvedValue({
        tokens: mockTokens,
        last: mockLast,
      });

      const result = await processTokenBucket(mockUserId, mockConfig);

      expectedAllowed
        ? expect(setTokenBucketState).toHaveBeenCalledWith(
            mockKey,
            mockConfig,
            expectedTokensLeft,
            mockNow
          )
        : expect(setTokenBucketState).not.toHaveBeenCalled();
      expect(result.allowed).toBe(expectedAllowed);
      expect(result.tokensLeft).toBeCloseTo(expectedTokensLeft);
    }
  );
});
