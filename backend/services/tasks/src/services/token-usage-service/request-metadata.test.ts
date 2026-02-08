import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockRequestMetadata,
  mockTokenUsageRequestId,
} from "@mocks/token-usage-mocks";
import {
  getRequestMetadata,
  getRequestMetadataKey,
  storeRequestMetadata,
} from "@services/token-usage-service";
import { createLoggerMock } from "@shared/mocks/logger-mock";
import { createRedisClientMock } from "@shared/mocks/redis-mock";
import type { RequestMetadata } from "@shared/types";

const { mockLoggerDebug, mockLoggerError } = vi.hoisted(() =>
  createLoggerMock(),
);

vi.mock("@shared/config/create-logger", () => ({
  createLogger: vi.fn(() => ({
    debug: mockLoggerDebug,
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe("requestMetadata", () => {
  let mockRedisClient: Redis;

  beforeEach(() => {
    mockRedisClient = createRedisClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getRequestMetadataKey", () => {
    it("should return the correct Redis key format", () => {
      const key = getRequestMetadataKey(mockTokenUsageRequestId);
      expect(key).toBe(`request-metadata:${mockTokenUsageRequestId}`);
    });
  });

  describe("storeRequestMetadata", () => {
    it("should store metadata in Redis with correct TTL", async () => {
      await storeRequestMetadata(
        mockRedisClient,
        mockTokenUsageRequestId,
        mockRequestMetadata,
      );

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `request-metadata:${mockTokenUsageRequestId}`,
        3600, // 1 hour TTL
        JSON.stringify(mockRequestMetadata),
      );
    });

    it("should log debug message on successful storage", async () => {
      await storeRequestMetadata(
        mockRedisClient,
        mockTokenUsageRequestId,
        mockRequestMetadata,
      );

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Request metadata stored successfully",
        {
          requestId: mockTokenUsageRequestId,
          key: `request-metadata:${mockTokenUsageRequestId}`,
          ttl: 3600,
        },
      );
    });

    it("should serialize all metadata fields correctly", async () => {
      await storeRequestMetadata(
        mockRedisClient,
        mockTokenUsageRequestId,
        mockRequestMetadata,
      );

      const serializedData = vi.mocked(mockRedisClient.setex).mock
        .calls[0][2] as string;
      const parsed = JSON.parse(serializedData);

      expect(parsed).toEqual(mockRequestMetadata);
      expect(parsed.userId).toBe(123);
      expect(parsed.tokensReserved).toBe(500);
      expect(parsed.windowStartTimestamp).toBe(1234567890000);
      expect(parsed.startTime).toBe(1234567890000);
      expect(parsed.serviceName).toBe("tasks");
      expect(parsed.rateLimiterName).toBe("openai-token-usage");
    });
  });

  describe("getRequestMetadata", () => {
    it("should retrieve and parse metadata successfully", async () => {
      vi.mocked(mockRedisClient.get).mockResolvedValue(
        JSON.stringify(mockRequestMetadata),
      );

      const result = await getRequestMetadata(
        mockRedisClient,
        mockTokenUsageRequestId,
      );

      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `request-metadata:${mockTokenUsageRequestId}`,
      );
      expect(result).toEqual(mockRequestMetadata);
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Request metadata retrieved successfully",
        {
          requestId: mockTokenUsageRequestId,
          key: `request-metadata:${mockTokenUsageRequestId}`,
        },
      );
    });

    it("should return null when metadata is not found", async () => {
      vi.mocked(mockRedisClient.get).mockResolvedValue(null);

      const result = await getRequestMetadata(
        mockRedisClient,
        mockTokenUsageRequestId,
      );

      expect(result).toBeNull();
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Request metadata not found",
        {
          requestId: mockTokenUsageRequestId,
          key: `request-metadata:${mockTokenUsageRequestId}`,
        },
      );
    });

    it("should return null and log error on invalid JSON", async () => {
      const invalidJson = "{ invalid json }";
      vi.mocked(mockRedisClient.get).mockResolvedValue(invalidJson);

      const result = await getRequestMetadata(
        mockRedisClient,
        mockTokenUsageRequestId,
      );

      expect(result).toBeNull();
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to parse request metadata",
        expect.any(Error),
        {
          requestId: mockTokenUsageRequestId,
          key: `request-metadata:${mockTokenUsageRequestId}`,
          serializedMetadata: invalidJson,
        },
      );
    });

    it("should handle all field types correctly when parsing", async () => {
      const metadataWithDifferentValues: RequestMetadata = {
        userId: 999,
        tokensReserved: 1500,
        windowStartTimestamp: 9876543210000,
        startTime: 9876543210000,
        serviceName: "different-service",
        rateLimiterName: "different-limiter",
      };

      vi.mocked(mockRedisClient.get).mockResolvedValue(
        JSON.stringify(metadataWithDifferentValues),
      );

      const result = await getRequestMetadata(
        mockRedisClient,
        mockTokenUsageRequestId,
      );

      expect(result).toEqual(metadataWithDifferentValues);
      expect(result?.userId).toBe(999);
      expect(result?.tokensReserved).toBe(1500);
    });
  });
});
