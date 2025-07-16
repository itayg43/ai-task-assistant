import { afterEach, describe, expect, it, Mock, vi } from "vitest";

import { redis } from "@clients/redis";
import { TokenBucketRateLimiterConfig } from "@types";
import {
  getTokenBucketState,
  setTokenBucketState,
} from "@utils/token-bucket/token-bucket-state-utils";

vi.mock("@clients/redis");

describe("bucketStateUtils", () => {
  const mockKey = "token:bucket:state";
  const mockConfig: TokenBucketRateLimiterConfig = {
    rateLimiterName: "test",
    bucketSize: 100,
    refillRate: 1,
    bucketTtlSeconds: 100,
    lockTtlMs: 500,
  };
  let mockTokens = 50;
  let mockTimestamp = 0;

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getTokenBucketState", () => {
    it("should return the default state when no data in redis", async () => {
      (redis.hgetall as Mock).mockResolvedValue(undefined);

      const result = await getTokenBucketState(
        mockKey,
        mockConfig,
        mockTimestamp
      );

      expect(result.tokens).toBe(mockConfig.bucketSize);
      expect(result.last).toBe(mockTimestamp);
    });

    it("should return the data stored in redis", async () => {
      (redis.hgetall as Mock).mockResolvedValue({
        tokens: mockTokens,
        last: mockTimestamp,
      });

      const result = await getTokenBucketState(
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
      await setTokenBucketState(mockKey, mockConfig, mockTokens, mockTimestamp);

      expect(redis.hmset).toHaveBeenCalledWith(
        mockKey,
        "tokens",
        mockTokens,
        "last",
        mockTimestamp
      );
      expect(redis.expire).toHaveBeenCalledWith(
        mockKey,
        mockConfig.bucketTtlSeconds
      );
    });
  });
});
