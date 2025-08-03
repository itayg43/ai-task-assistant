import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { TokenBucketRateLimiterConfig } from "@types";
import {
  getTokenBucketState,
  setTokenBucketState,
} from "@utils/token-bucket/token-bucket-state-utils";

describe("bucketStateUtils", () => {
  let mockRedisClient: Partial<Redis>;

  const mockKey = "token:bucket:state";
  const mockConfig: TokenBucketRateLimiterConfig = {
    serviceName: "service",
    rateLimiterName: "test",
    bucketSize: 100,
    refillRate: 1,
    bucketTtlSeconds: 100,
    lockTtlMs: 500,
  };
  let mockTokens = 50;
  let mockTimestamp = 0;

  beforeEach(() => {
    mockRedisClient = {
      hgetall: vi.fn(),
      hmset: vi.fn(),
      expire: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getTokenBucketState", () => {
    it("should return the default state when no data in redis", async () => {
      (mockRedisClient.hgetall as Mock).mockResolvedValue(undefined);

      const result = await getTokenBucketState(
        mockRedisClient as Redis,
        mockKey,
        mockConfig,
        mockTimestamp
      );

      expect(result.tokens).toBe(mockConfig.bucketSize);
      expect(result.last).toBe(mockTimestamp);
    });

    it("should return the data stored in redis", async () => {
      (mockRedisClient.hgetall as Mock).mockResolvedValue({
        tokens: mockTokens,
        last: mockTimestamp,
      });

      const result = await getTokenBucketState(
        mockRedisClient as Redis,
        mockKey,
        mockConfig,
        mockTimestamp
      );

      expect(result.tokens).toBe(mockTokens);
      expect(result.last).toBe(mockTimestamp);
    });
  });

  describe("setTokenBucketState", () => {
    it("should set the updated state and set the expire correctly", async () => {
      await setTokenBucketState(
        mockRedisClient as Redis,
        mockKey,
        mockConfig,
        mockTokens,
        mockTimestamp
      );

      expect(mockRedisClient.hmset).toHaveBeenCalledWith(
        mockKey,
        "tokens",
        mockTokens,
        "last",
        mockTimestamp
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        mockKey,
        mockConfig.bucketTtlSeconds
      );
    });
  });
});
