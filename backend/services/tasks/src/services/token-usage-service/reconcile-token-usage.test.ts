import Redis from "ioredis";
import Redlock from "redlock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockUserId } from "@mocks/tasks-mocks";
import {
  mockActualTokens,
  mockLockTtlMs,
  mockRequestMetadata,
  mockTokenUsageRequestId,
} from "@mocks/token-usage-mocks";
import { reconcileTokenUsage } from "@services/token-usage-service";
import { createRedisClientMock } from "@shared/mocks/redis-mock";
import { createRedlockClientMock } from "@shared/mocks/redlock-mock";
import type { Mocked } from "@shared/types";
import { getTokenBucketLockKey } from "@shared/utils/token-bucket/key-utils";
import { updateTokenUsage } from "@shared/utils/token-bucket/update-token-usage";
import { withLock } from "@shared/utils/with-lock";

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

vi.mock("@shared/utils/token-bucket/update-token-usage");
vi.mock("@shared/utils/with-lock");

describe("reconcileTokenUsage", () => {
  let mockRedisClient: Redis;
  let mockRedlockClient: Redlock;
  let mockedUpdateTokenUsage: Mocked<typeof updateTokenUsage>;
  let mockedWithLock: Mocked<typeof withLock>;

  beforeEach(() => {
    mockRedisClient = createRedisClientMock();
    mockRedlockClient = createRedlockClientMock();

    mockedUpdateTokenUsage = vi.mocked(updateTokenUsage);

    mockedWithLock = vi.mocked(withLock);
    mockedWithLock.mockImplementation(async (_client, _key, _ttl, fn) => {
      return await fn();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should reconcile token usage successfully", async () => {
    await reconcileTokenUsage(
      mockRedisClient,
      mockRedlockClient,
      mockTokenUsageRequestId,
      mockRequestMetadata,
      mockActualTokens,
      mockLockTtlMs,
    );

    // Calculate expected lock key using real function and mock metadata
    const expectedLockKey = getTokenBucketLockKey(
      mockRequestMetadata.serviceName,
      mockRequestMetadata.rateLimiterName,
      mockUserId,
    );

    expect(mockedWithLock).toHaveBeenCalledWith(
      mockRedlockClient,
      expectedLockKey,
      mockLockTtlMs,
      expect.any(Function),
      {
        requestId: mockTokenUsageRequestId,
        operation: "reconcileTokenUsage",
      },
    );
    expect(mockedUpdateTokenUsage).toHaveBeenCalledWith(
      mockRedisClient,
      mockRequestMetadata.serviceName,
      mockRequestMetadata.rateLimiterName,
      mockUserId,
      mockActualTokens,
      mockRequestMetadata.tokensReserved,
      mockRequestMetadata.windowStartTimestamp,
    );
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      "Token usage reconciled successfully",
      {
        requestId: mockTokenUsageRequestId,
        metadata: mockRequestMetadata,
        actualTokens: mockActualTokens,
      },
    );
  });

  it("should catch and log errors when reconciliation fails", async () => {
    const mockError = new Error("Lock acquisition failed");
    mockedWithLock.mockRejectedValue(mockError);

    // Should not throw - errors are caught internally
    await reconcileTokenUsage(
      mockRedisClient,
      mockRedlockClient,
      mockTokenUsageRequestId,
      mockRequestMetadata,
      mockActualTokens,
      mockLockTtlMs,
    );

    expect(mockLoggerError).toHaveBeenCalledWith(
      "Token usage reconciliation failed",
      mockError,
      {
        requestId: mockTokenUsageRequestId,
        metadata: mockRequestMetadata,
        actualTokens: mockActualTokens,
      },
    );
    // Success logging should not occur
    expect(mockLoggerDebug).not.toHaveBeenCalled();
  });
});
