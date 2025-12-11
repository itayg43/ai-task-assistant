import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import {
  TOKEN_BUCKET_FIELD_LAST,
  TOKEN_BUCKET_FIELD_TOKENS,
} from "../../../constants";
import { createRedisClientMock } from "../../../mocks/redis-mock";
import {
  mockTimestamp,
  mockTokenBucketConfig,
  mockTokenBucketKey,
  mockTokens,
} from "../__tests__/token-bucket-test-constants";
import {
  decrementTokenBucket,
  getTokenBucketState,
  incrementTokenBucket,
  updateTokenBucketTimestamp,
} from "../token-bucket-state-utils";

describe("bucketStateUtils", () => {
  let mockRedisClient: Redis;

  beforeEach(() => {
    mockRedisClient = createRedisClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getTokenBucketState", () => {
    it("should initialize and return default state when no data in redis", async () => {
      (mockRedisClient.hgetall as Mock).mockResolvedValue(undefined);
      (mockRedisClient.hset as Mock).mockResolvedValue(1); // Fields were set

      const result = await getTokenBucketState(
        mockRedisClient,
        mockTokenBucketKey,
        mockTokenBucketConfig,
        mockTimestamp
      );

      // Verify that hset was called to initialize both fields atomically
      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        mockTokenBucketKey,
        TOKEN_BUCKET_FIELD_TOKENS,
        mockTokenBucketConfig.bucketSize,
        TOKEN_BUCKET_FIELD_LAST,
        mockTimestamp
      );

      expect(result.tokens).toBe(mockTokenBucketConfig.bucketSize);
      expect(result.last).toBe(mockTimestamp);
    });

    it("should return the data stored in redis without initializing", async () => {
      (mockRedisClient.hgetall as Mock).mockResolvedValue({
        [TOKEN_BUCKET_FIELD_TOKENS]: mockTokens,
        [TOKEN_BUCKET_FIELD_LAST]: mockTimestamp,
      });

      const result = await getTokenBucketState(
        mockRedisClient,
        mockTokenBucketKey,
        mockTokenBucketConfig,
        mockTimestamp
      );

      // Verify that hset was NOT called since field already exists
      expect(mockRedisClient.hset).not.toHaveBeenCalled();

      expect(result.tokens).toBe(mockTokens);
      expect(result.last).toBe(mockTimestamp);
    });
  });

  describe("incrementTokenBucket", () => {
    it("should use HINCRBY to atomically increment tokens and return new value", async () => {
      const incrementAmount = 10;
      const expectedNewValue = mockTokens + incrementAmount;

      (mockRedisClient.hincrby as Mock).mockResolvedValue(expectedNewValue);

      const result = await incrementTokenBucket(
        mockRedisClient,
        mockTokenBucketKey,
        incrementAmount
      );

      expect(mockRedisClient.hincrby).toHaveBeenCalledWith(
        mockTokenBucketKey,
        TOKEN_BUCKET_FIELD_TOKENS,
        incrementAmount
      );
      expect(result).toBe(expectedNewValue);
    });
  });

  describe("decrementTokenBucket", () => {
    it("should use HINCRBY to atomically decrement tokens and return new value", async () => {
      const decrementAmount = 5;
      const expectedNewValue = mockTokens - decrementAmount;

      (mockRedisClient.hincrby as Mock).mockResolvedValue(expectedNewValue);

      const result = await decrementTokenBucket(
        mockRedisClient,
        mockTokenBucketKey,
        decrementAmount
      );

      expect(mockRedisClient.hincrby).toHaveBeenCalledWith(
        mockTokenBucketKey,
        TOKEN_BUCKET_FIELD_TOKENS,
        -decrementAmount
      );
      expect(result).toBe(expectedNewValue);
    });
  });

  describe("updateTokenBucketTimestamp", () => {
    it("should use HSET to update timestamp and EXPIRE to set TTL", async () => {
      const timestamp = 1234567890;
      const ttlSeconds = 100;

      await updateTokenBucketTimestamp(
        mockRedisClient,
        mockTokenBucketKey,
        timestamp,
        ttlSeconds
      );

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        mockTokenBucketKey,
        TOKEN_BUCKET_FIELD_LAST,
        timestamp
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        mockTokenBucketKey,
        ttlSeconds
      );
    });
  });
});
