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

import { reconcileTokenUsage } from "./reconcile-token-usage";

const { mockLoggerDebug } = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
}));

vi.mock("@shared/config/create-logger", () => ({
  createLogger: vi.fn(() => ({
    debug: mockLoggerDebug,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@shared/utils/token-bucket/key-utils");
vi.mock("@shared/utils/token-bucket/update-token-usage");
vi.mock("@shared/utils/with-lock");

describe("reconcileTokenUsage", () => {
  let mockRedisClient: Redis;
  let mockRedlockClient: Redlock;
  let mockedGetTokenBucketLockKey: Mocked<typeof getTokenBucketLockKey>;
  let mockedUpdateTokenUsage: Mocked<typeof updateTokenUsage>;
  let mockedWithLock: Mocked<typeof withLock>;

  beforeEach(() => {
    mockRedisClient = createRedisClientMock();
    mockRedlockClient = createRedlockClientMock();

    mockedGetTokenBucketLockKey = vi.mocked(getTokenBucketLockKey);
    mockedUpdateTokenUsage = vi.mocked(updateTokenUsage);
    mockedWithLock = vi.mocked(withLock);

    // Default mock implementations
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

  it("should reconcile token usage successfully", async () => {
    await reconcileTokenUsage(
      mockRedisClient,
      mockRedlockClient,
      mockTokenUsageRequestId,
      mockRequestMetadata,
      mockActualTokens,
      mockLockTtlMs
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
        operation: "reconcileTokenUsage",
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
  });
});
