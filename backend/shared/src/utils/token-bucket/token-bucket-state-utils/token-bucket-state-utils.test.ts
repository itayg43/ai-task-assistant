import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { createRedisClientMock } from "../../../mocks/redis-mock";
import { TokenBucketRateLimiterConfig } from "../../../types";
import {
  getTokenBucketState,
  setTokenBucketState,
} from "../token-bucket-state-utils";

describe("bucketStateUtils", () => {
  let mockRedisClient: Redis;

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
    mockRedisClient = createRedisClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getTokenBucketState", () => {
    it("should return the default state when no data in redis", async () => {
      (mockRedisClient.hgetall as Mock).mockResolvedValue(undefined);

      const result = await getTokenBucketState(
        mockRedisClient,
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
        mockRedisClient,
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
        mockRedisClient,
        mockKey,
        mockConfig,
        mockTokens,
        mockTimestamp
      );

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
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
