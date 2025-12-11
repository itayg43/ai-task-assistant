import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MS_PER_SECOND } from "../../../constants";
import { createRedisClientMock } from "../../../mocks/redis-mock";
import { Mocked } from "../../../types";
import { getTokenBucketKey } from "../key-utils";
import { processTokenBucket } from "../process-token-bucket";
import {
  decrementTokenBucket,
  getTokenBucketState,
  incrementTokenBucket,
  updateTokenBucketTimestamp,
} from "../token-bucket-state-utils";
import {
  mockProcessTokenBucketKey,
  mockTokenBucketConfig,
} from "../__tests__/token-bucket-test-constants";
import { mockUserId } from "../__tests__/token-usage-test-constants";

vi.mock("../key-utils");
vi.mock("../token-bucket-state-utils");

/**
 * - Separate test for multiple sequential requests.
 * - Table-driven tests for processTokenBucket scenarios.
 */

describe("processTokenBucket", () => {
  let mockedGetTokenBucketKey: Mocked<typeof getTokenBucketKey>;
  let mockedGetTokenBucketState: Mocked<typeof getTokenBucketState>;
  let mockedIncrementTokenBucket: Mocked<typeof incrementTokenBucket>;
  let mockedDecrementTokenBucket: Mocked<typeof decrementTokenBucket>;
  let mockedUpdateTokenBucketTimestamp: Mocked<
    typeof updateTokenBucketTimestamp
  >;

  let mockRedisClient: Redis;

  const cases = [
    {
      description: "should handle first time access - no existing state",
      mockNow: 1000,
      mockTokens: mockTokenBucketConfig.bucketSize,
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

  // This calculation intentionally mirrors the refill logic in processTokenBucket for test accuracy.
  // If the implementation changes, update this function to match the intended behavior.
  // Do NOT import or reuse the implementation logic directly here.
  const calculateExpectedTokensLeft = (
    expectedAllowed: boolean,
    mockTokens: number,
    mockNow: number,
    mockLast: number
  ) => {
    const elapsed = (mockNow - mockLast) / MS_PER_SECOND;
    const tokensToAdd = parseInt(
      (elapsed * mockTokenBucketConfig.refillRate).toString(),
      10
    );
    const updatedTokens = Math.min(
      mockTokens + tokensToAdd,
      mockTokenBucketConfig.bucketSize
    );

    return expectedAllowed ? updatedTokens - 1 : updatedTokens;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockedGetTokenBucketKey = vi.mocked(getTokenBucketKey);
    mockedGetTokenBucketState = vi.mocked(getTokenBucketState);
    mockedIncrementTokenBucket = vi.mocked(incrementTokenBucket);
    mockedDecrementTokenBucket = vi.mocked(decrementTokenBucket);
    mockedUpdateTokenBucketTimestamp = vi.mocked(updateTokenBucketTimestamp);

    mockRedisClient = createRedisClientMock();
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

    mockedGetTokenBucketKey.mockReturnValue(mockProcessTokenBucketKey);
    mockedGetTokenBucketState.mockResolvedValue({
      tokens: mockTokens,
      last: mockLast,
    });
    mockedIncrementTokenBucket.mockResolvedValue(mockTokens); // No refill needed
    mockedDecrementTokenBucket.mockResolvedValue(1); // After decrement: 2 - 1 = 1

    // First request: allowed, tokens = 1
    let result = await processTokenBucket(
      mockRedisClient,
      mockTokenBucketConfig,
      mockUserId
    );
    expect(result.allowed).toBe(true);
    expect(result.tokensLeft).toBe(1);

    // Second request: allowed, tokens = 0
    mockedGetTokenBucketState.mockResolvedValue({
      tokens: 1,
      last: mockNow,
    });
    mockedIncrementTokenBucket.mockResolvedValue(1); // No refill needed
    mockedDecrementTokenBucket.mockResolvedValue(0); // After decrement: 1 - 1 = 0
    result = await processTokenBucket(
      mockRedisClient,
      mockTokenBucketConfig,
      mockUserId
    );
    expect(result.allowed).toBe(true);
    expect(result.tokensLeft).toBe(0);

    // Third request: denied, tokens = 0
    mockedGetTokenBucketState.mockResolvedValue({
      tokens: 0,
      last: mockNow,
    });
    mockedIncrementTokenBucket.mockResolvedValue(0); // No refill needed
    result = await processTokenBucket(
      mockRedisClient,
      mockTokenBucketConfig,
      mockUserId
    );
    expect(result.allowed).toBe(false);
    expect(result.tokensLeft).toBe(0);
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

      mockedGetTokenBucketKey.mockReturnValue(mockProcessTokenBucketKey);
      mockedGetTokenBucketState.mockResolvedValue({
        tokens: mockTokens,
        last: mockLast,
      });

      // Calculate expected behavior for mocks
      const elapsed = (mockNow - mockLast) / MS_PER_SECOND;
      const tokensToAdd = parseInt(
        (elapsed * mockTokenBucketConfig.refillRate).toString(),
        10
      );
      const maxIncrement = Math.max(
        0,
        mockTokenBucketConfig.bucketSize - mockTokens
      );
      const actualIncrement = Math.min(tokensToAdd, maxIncrement);
      const tokensAfterRefill = Math.min(
        mockTokenBucketConfig.bucketSize,
        mockTokens + tokensToAdd
      );

      // Mock incrementTokenBucket if there's a refill
      if (actualIncrement > 0) {
        mockedIncrementTokenBucket.mockResolvedValue(tokensAfterRefill);
      }

      // Mock decrementTokenBucket if request is allowed
      if (expectedAllowed) {
        mockedDecrementTokenBucket.mockResolvedValue(expectedTokensLeft);
      }

      // Mock updateTokenBucketTimestamp (always called)
      mockedUpdateTokenBucketTimestamp.mockResolvedValue(undefined);

      const result = await processTokenBucket(
        mockRedisClient,
        mockTokenBucketConfig,
        mockUserId
      );

      // Verify atomic operations were called correctly
      if (actualIncrement > 0) {
        expect(mockedIncrementTokenBucket).toHaveBeenCalledWith(
          mockRedisClient,
          mockProcessTokenBucketKey,
          actualIncrement
        );
      }

      if (expectedAllowed) {
        expect(mockedDecrementTokenBucket).toHaveBeenCalledWith(
          mockRedisClient,
          mockProcessTokenBucketKey,
          1
        );
      }

      // updateTokenBucketTimestamp should always be called
      expect(mockedUpdateTokenBucketTimestamp).toHaveBeenCalledWith(
        mockRedisClient,
        mockProcessTokenBucketKey,
        mockNow,
        mockTokenBucketConfig.bucketTtlSeconds
      );

      expect(result.allowed).toBe(expectedAllowed);
      expect(result.tokensLeft).toBe(expectedTokensLeft);
    }
  );
});
