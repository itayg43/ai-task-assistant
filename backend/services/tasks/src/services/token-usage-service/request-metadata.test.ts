import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRedisClientMock } from "@shared/mocks/redis-mock";
import type { Mocked, RequestMetadata } from "@shared/types";

import {
  getRequestMetadata,
  getRequestMetadataKey,
  storeRequestMetadata,
} from "./request-metadata";

const { mockLoggerDebug, mockLoggerError } = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@shared/config/create-logger", () => ({
  createLogger: vi.fn(() => ({
    debug: mockLoggerDebug,
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe("request-metadata", () => {
  let mockRedisClient: Redis;

  const mockRequestId = "test-request-id";
  const mockMetadata: RequestMetadata = {
    userId: 123,
    tokensReserved: 500,
    windowStartTimestamp: 1234567890000,
    startTime: 1234567890000,
    serviceName: "tasks",
    rateLimiterName: "openai-token-usage",
  };

  beforeEach(() => {
    mockRedisClient = createRedisClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getRequestMetadataKey", () => {
    it("should return the correct Redis key format", () => {
      const key = getRequestMetadataKey(mockRequestId);
      expect(key).toBe(`request-metadata:${mockRequestId}`);
    });
  });

  describe("storeRequestMetadata", () => {
    it("should store metadata in Redis with correct TTL", async () => {
      await storeRequestMetadata(
        mockRedisClient,
        mockRequestId,
        mockMetadata
      );

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `request-metadata:${mockRequestId}`,
        3600, // 1 hour TTL
        JSON.stringify(mockMetadata)
      );
    });

    it("should log debug message on successful storage", async () => {
      await storeRequestMetadata(
        mockRedisClient,
        mockRequestId,
        mockMetadata
      );

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Request metadata stored successfully",
        {
          requestId: mockRequestId,
          key: `request-metadata:${mockRequestId}`,
          ttl: 3600,
        }
      );
    });

    it("should serialize all metadata fields correctly", async () => {
      await storeRequestMetadata(
        mockRedisClient,
        mockRequestId,
        mockMetadata
      );

      const serializedData = vi.mocked(mockRedisClient.setex).mock.calls[0][2] as string;
      const parsed = JSON.parse(serializedData);

      expect(parsed).toEqual(mockMetadata);
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
      vi.mocked(mockRedisClient.get).mockResolvedValue(JSON.stringify(mockMetadata));

      const result = await getRequestMetadata(mockRedisClient, mockRequestId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `request-metadata:${mockRequestId}`
      );
      expect(result).toEqual(mockMetadata);
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Request metadata retrieved successfully",
        {
          requestId: mockRequestId,
          key: `request-metadata:${mockRequestId}`,
        }
      );
    });

    it("should return null when metadata is not found", async () => {
      vi.mocked(mockRedisClient.get).mockResolvedValue(null);

      const result = await getRequestMetadata(mockRedisClient, mockRequestId);

      expect(result).toBeNull();
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Request metadata not found",
        {
          requestId: mockRequestId,
          key: `request-metadata:${mockRequestId}`,
        }
      );
    });

    it("should return null and log error on invalid JSON", async () => {
      const invalidJson = "{ invalid json }";
      vi.mocked(mockRedisClient.get).mockResolvedValue(invalidJson);

      const result = await getRequestMetadata(mockRedisClient, mockRequestId);

      expect(result).toBeNull();
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to parse request metadata",
        expect.any(Error),
        {
          requestId: mockRequestId,
          key: `request-metadata:${mockRequestId}`,
          serializedMetadata: invalidJson,
        }
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
        JSON.stringify(metadataWithDifferentValues)
      );

      const result = await getRequestMetadata(mockRedisClient, mockRequestId);

      expect(result).toEqual(metadataWithDifferentValues);
      expect(result?.userId).toBe(999);
      expect(result?.tokensReserved).toBe(1500);
    });
  });
});
