import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import {
  TOKEN_USAGE_FIELD_TOKENS_USED,
  TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP,
} from "../../../constants";
import { createRedisClientMock } from "../../../mocks/redis-mock";
import {
  decrementTokenUsage,
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
    it("should return default state when no data in redis", async () => {
      (mockRedisClient.hgetall as Mock).mockResolvedValue(undefined);

      const result = await getTokenUsageState(
        mockRedisClient,
        mockKey,
        mockWindowStartTimestamp
      );

      expect(result.tokensUsed).toBe(0);
      expect(result.windowStartTimestamp).toBe(mockWindowStartTimestamp);
    });

    it("should return the data stored in redis", async () => {
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
});
