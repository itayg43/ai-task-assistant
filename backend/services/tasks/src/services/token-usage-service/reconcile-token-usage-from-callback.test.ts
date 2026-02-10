import Redis from "ioredis";
import Redlock from "redlock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRedisClientMock } from "@shared/mocks/redis-mock";
import { createRedlockClientMock } from "@shared/mocks/redlock-mock";
import type { Mocked } from "@shared/types";
import { getTokenBucketLockKey } from "@shared/utils/token-bucket/key-utils";
import { updateTokenUsage } from "@shared/utils/token-bucket/update-token-usage";
import { withLock } from "@shared/utils/with-lock";
import {
  mockActualTokens,
  mockLockTtlMs,
  mockRequestMetadata,
  mockTokenUsageRequestId,
} from "@mocks/token-usage-mocks";

import { getRequestMetadata, getRequestMetadataKey } from "./request-metadata";
import { reconcileTokenUsageFromCallback } from "./reconcile-token-usage-from-callback";

const { mockLoggerDebug, mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock("@shared/config/create-logger", () => ({
  createLogger: vi.fn(() => ({
    debug: mockLoggerDebug,
    warn: mockLoggerWarn,
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@shared/utils/token-bucket/key-utils");
vi.mock("@shared/utils/token-bucket/update-token-usage");
vi.mock("@shared/utils/with-lock");
vi.mock("./request-metadata", async (importOriginal) => {
  const original = await importOriginal<typeof import("./request-metadata")>();
  return {
    ...original,
    getRequestMetadata: vi.fn(),
    getRequestMetadataKey: vi.fn(),
  };
});

describe("reconcileTokenUsageFromCallback", () => {
  let mockRedisClient: Redis;
  let mockRedlockClient: Redlock;
  let mockedGetRequestMetadata: Mocked<typeof getRequestMetadata>;
  let mockedGetRequestMetadataKey: Mocked<typeof getRequestMetadataKey>;
  let mockedGetTokenBucketLockKey: Mocked<typeof getTokenBucketLockKey>;
  let mockedUpdateTokenUsage: Mocked<typeof updateTokenUsage>;
  let mockedWithLock: Mocked<typeof withLock>;

  beforeEach(() => {
    mockRedisClient = createRedisClientMock();
    mockRedlockClient = createRedlockClientMock();

    mockedGetRequestMetadata = vi.mocked(getRequestMetadata);
    mockedGetRequestMetadataKey = vi.mocked(getRequestMetadataKey);
    mockedGetTokenBucketLockKey = vi.mocked(getTokenBucketLockKey);
    mockedUpdateTokenUsage = vi.mocked(updateTokenUsage);
    mockedWithLock = vi.mocked(withLock);

    // Default mock implementations
    mockedGetRequestMetadata.mockResolvedValue(mockRequestMetadata);
    mockedGetRequestMetadataKey.mockReturnValue(
      `request-metadata:${mockTokenUsageRequestId}`
    );
    mockedGetTokenBucketLockKey.mockReturnValue(
      "token-bucket:tasks:openai-token-usage:123"
    );
    mockedWithLock.mockImplementation(async (_client, _key, _ttl, fn) => {
      return await fn();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should reconcile token usage successfully when metadata exists", async () => {
    const result = await reconcileTokenUsageFromCallback(
      mockRedisClient,
      mockRedlockClient,
      mockTokenUsageRequestId,
      mockActualTokens,
      mockLockTtlMs
    );

    // Verify metadata retrieval
    expect(mockedGetRequestMetadata).toHaveBeenCalledWith(
      mockRedisClient,
      mockTokenUsageRequestId
    );

    // Verify lock acquisition
    expect(mockedGetTokenBucketLockKey).toHaveBeenCalledWith(
      "tasks",
      "openai-token-usage",
      123
    );
    expect(mockedWithLock).toHaveBeenCalledWith(
      mockRedlockClient,
      "token-bucket:tasks:openai-token-usage:123",
      mockLockTtlMs,
      expect.any(Function),
      {
        requestId: mockTokenUsageRequestId,
        operation: "reconcileTokenUsageFromCallback",
      }
    );

    // Verify token usage update
    expect(mockedUpdateTokenUsage).toHaveBeenCalledWith(
      mockRedisClient,
      "tasks",
      "openai-token-usage",
      123,
      mockActualTokens,
      500,
      1234567890000
    );

    // Verify metadata cleanup
    expect(mockedGetRequestMetadataKey).toHaveBeenCalledWith(mockTokenUsageRequestId);
    expect(mockRedisClient.del).toHaveBeenCalledWith(
      `request-metadata:${mockTokenUsageRequestId}`
    );

    // Verify logging
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      "Token usage reconciled successfully",
      {
        requestId: mockTokenUsageRequestId,
        userId: 123,
        actualTokens: mockActualTokens,
        tokensReserved: 500,
        startTime: 1234567890000,
      }
    );

    // Verify return value
    expect(result).toBe(1234567890000);
  });

  it("should return null and log warning when metadata not found (indicates TTL expired)", async () => {
    mockedGetRequestMetadata.mockResolvedValue(null);

    const result = await reconcileTokenUsageFromCallback(
      mockRedisClient,
      mockRedlockClient,
      mockTokenUsageRequestId,
      mockActualTokens,
      mockLockTtlMs
    );

    expect(result).toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Cannot reconcile token usage: metadata not found",
      {
        requestId: mockTokenUsageRequestId,
      }
    );
    expect(mockedWithLock).not.toHaveBeenCalled();
    expect(mockedUpdateTokenUsage).not.toHaveBeenCalled();
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });
});
