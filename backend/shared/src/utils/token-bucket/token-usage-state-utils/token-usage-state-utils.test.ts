import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import {
  MS_PER_SECOND,
  TOKEN_USAGE_FIELD_TOKENS_USED,
  TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP,
} from "../../../constants";
import { createRedisClientMock } from "../../../mocks/redis-mock";
import {
  decrementTokenUsage,
  ensureTokenUsageWindowTtl,
  getTokenUsageState,
  incrementTokenUsage,
  resetTokenUsageWindow,
} from "./token-usage-state-utils";

describe("tokenUsageStateUtils", () => {
  let mockRedisClient: Redis;

  const mockKey = "token:usage:state";
  const mockWindowStartTimestamp = 1000;
  const mockTokensUsed = 500;
  const mockTtlSeconds = 86400;

  beforeEach(() => {
    mockRedisClient = createRedisClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getTokenUsageState", () => {
    it("should initialize key with default values when no data in redis", async () => {
      (mockRedisClient.hgetall as Mock).mockResolvedValue(undefined);
      (mockRedisClient.hset as Mock).mockResolvedValue(2);

      const result = await getTokenUsageState(
        mockRedisClient,
        mockKey,
        mockWindowStartTimestamp
      );

      // Should initialize both fields
      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        mockKey,
        TOKEN_USAGE_FIELD_TOKENS_USED,
        0,
        TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP,
        mockWindowStartTimestamp
      );

      expect(result.tokensUsed).toBe(0);
      expect(result.windowStartTimestamp).toBe(mockWindowStartTimestamp);
    });

    it("should not initialize when key already exists", async () => {
      (mockRedisClient.hgetall as Mock).mockResolvedValue({
        [TOKEN_USAGE_FIELD_TOKENS_USED]: mockTokensUsed.toString(),
        [TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP]:
          mockWindowStartTimestamp.toString(),
      });

      const result = await getTokenUsageState(
        mockRedisClient,
        mockKey,
        mockWindowStartTimestamp
      );

      // Should NOT call hset when key exists
      expect(mockRedisClient.hset).not.toHaveBeenCalled();

      expect(result.tokensUsed).toBe(mockTokensUsed);
      expect(result.windowStartTimestamp).toBe(mockWindowStartTimestamp);
    });
  });

  describe("resetTokenUsageWindow", () => {
    it("should reset tokensUsed to 0 and update windowStartTimestamp with TTL", async () => {
      const newWindowStartTimestamp = 2000;

      await resetTokenUsageWindow(
        mockRedisClient,
        mockKey,
        newWindowStartTimestamp,
        mockTtlSeconds
      );

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        mockKey,
        TOKEN_USAGE_FIELD_TOKENS_USED,
        0,
        TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP,
        newWindowStartTimestamp
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        mockKey,
        mockTtlSeconds
      );
    });
  });

  describe("incrementTokenUsage", () => {
    it("should use HINCRBY to atomically increment tokensUsed and return new value", async () => {
      const amount = 100;
      const expectedNewValue = 600;

      (mockRedisClient.hincrby as Mock).mockResolvedValue(expectedNewValue);

      const result = await incrementTokenUsage(
        mockRedisClient,
        mockKey,
        amount
      );

      expect(mockRedisClient.hincrby).toHaveBeenCalledWith(
        mockKey,
        TOKEN_USAGE_FIELD_TOKENS_USED,
        amount
      );
      expect(result).toBe(expectedNewValue);
    });
  });

  describe("decrementTokenUsage", () => {
    it("should use HINCRBY to atomically decrement tokensUsed and return new value", async () => {
      const amount = 100;
      const expectedNewValue = 400;

      (mockRedisClient.hincrby as Mock).mockResolvedValue(expectedNewValue);

      const result = await decrementTokenUsage(
        mockRedisClient,
        mockKey,
        amount
      );

      expect(mockRedisClient.hincrby).toHaveBeenCalledWith(
        mockKey,
        TOKEN_USAGE_FIELD_TOKENS_USED,
        -amount
      );
      expect(result).toBe(expectedNewValue);
    });
  });

  describe("ensureTokenUsageWindowTtl", () => {
    it("should set TTL when key has no expiration", async () => {
      const mockWindowSizeSeconds = 86400; // 24 hours
      const mockCurrentTime = mockWindowStartTimestamp + 10000;

      // Mock ttl to return -1 (no expiration)
      (mockRedisClient.ttl as Mock).mockResolvedValue(-1);
      (mockRedisClient.expire as Mock).mockResolvedValue(1);

      await ensureTokenUsageWindowTtl(
        mockRedisClient,
        mockKey,
        mockWindowStartTimestamp,
        mockWindowSizeSeconds,
        mockCurrentTime
      );

      // Should check TTL
      expect(mockRedisClient.ttl).toHaveBeenCalledWith(mockKey);

      // Should set TTL to expire at window end
      const expectedTtl = Math.ceil(
        (mockWindowStartTimestamp +
          mockWindowSizeSeconds * MS_PER_SECOND -
          mockCurrentTime) /
          MS_PER_SECOND
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(mockKey, expectedTtl);
    });

    it("should not set TTL when key already has expiration", async () => {
      // Mock ttl to return positive value (has expiration)
      (mockRedisClient.ttl as Mock).mockResolvedValue(3600);
      (mockRedisClient.expire as Mock).mockResolvedValue(1);

      await ensureTokenUsageWindowTtl(
        mockRedisClient,
        mockKey,
        mockWindowStartTimestamp,
        mockTtlSeconds,
        mockWindowStartTimestamp + 10000
      );

      // Should check TTL
      expect(mockRedisClient.ttl).toHaveBeenCalledWith(mockKey);

      // Should NOT set TTL
      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });

    it("should not set TTL when key doesn't exist", async () => {
      // Mock ttl to return -2 (key doesn't exist)
      (mockRedisClient.ttl as Mock).mockResolvedValue(-2);
      (mockRedisClient.expire as Mock).mockResolvedValue(0);

      await ensureTokenUsageWindowTtl(
        mockRedisClient,
        mockKey,
        mockWindowStartTimestamp,
        mockTtlSeconds,
        mockWindowStartTimestamp + 10000
      );

      // Should check TTL
      expect(mockRedisClient.ttl).toHaveBeenCalledWith(mockKey);

      // Should NOT set TTL (key doesn't exist)
      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });

    it("should calculate correct TTL to expire at window end", async () => {
      const mockWindowSizeSeconds = mockTtlSeconds; // Use existing mock value
      const mockCurrentTime = mockWindowStartTimestamp + 1000;

      (mockRedisClient.ttl as Mock).mockResolvedValue(-1);
      (mockRedisClient.expire as Mock).mockResolvedValue(1);

      await ensureTokenUsageWindowTtl(
        mockRedisClient,
        mockKey,
        mockWindowStartTimestamp,
        mockWindowSizeSeconds,
        mockCurrentTime
      );

      const windowEndMs =
        mockWindowStartTimestamp + mockWindowSizeSeconds * MS_PER_SECOND;
      const expectedTtl = Math.ceil(
        (windowEndMs - mockCurrentTime) / MS_PER_SECOND
      );

      expect(mockRedisClient.expire).toHaveBeenCalledWith(mockKey, expectedTtl);
    });
  });
});
