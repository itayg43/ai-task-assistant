import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockRequestMetadata,
  mockTokenUsageRequestId,
} from "@mocks/token-usage-mocks";
import {
  getRequestMetadata,
  getRequestMetadataKey,
  REQUEST_METADATA_KEY_PREFIX,
  REQUEST_METADATA_TTL_SECONDS,
  storeRequestMetadata,
} from "@services/token-usage-service";
import { createRedisClientMock } from "@shared/mocks/redis-mock";

const { mockLoggerDebug, mockLoggerError } = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@shared/config/create-logger", () => ({
  createLogger: vi.fn(() => ({
    debug: mockLoggerDebug,
    error: mockLoggerError,
  })),
}));

describe("requestMetadata", () => {
  let mockRedisClient: Redis;

  let testKey: string;

  beforeEach(() => {
    mockRedisClient = createRedisClientMock();

    testKey = getRequestMetadataKey(mockTokenUsageRequestId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getRequestMetadataKey", () => {
    it("should return the correct Redis key format", () => {
      expect(testKey).toBe(
        `${REQUEST_METADATA_KEY_PREFIX}${mockTokenUsageRequestId}`,
      );
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
        testKey,
        REQUEST_METADATA_TTL_SECONDS,
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
          key: testKey,
          ttl: REQUEST_METADATA_TTL_SECONDS,
        },
      );
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

      expect(mockRedisClient.get).toHaveBeenCalledWith(testKey);
      expect(result).toEqual(mockRequestMetadata);
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Request metadata retrieved successfully",
        {
          requestId: mockTokenUsageRequestId,
          key: testKey,
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
          key: testKey,
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
          key: testKey,
          serializedMetadata: invalidJson,
        },
      );
    });
  });
});
