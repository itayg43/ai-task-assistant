import { NextFunction, Request, Response } from "express";
import Redis from "ioredis";
import Redlock from "redlock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRedisClientMock } from "../../../mocks/redis-mock";
import { createRedlockClientMock } from "../../../mocks/redlock-mock";
import { Mocked } from "../../../types";
import { getAuthenticationContext } from "../../../utils/authentication-context";
import { getTokenBucketLockKey } from "../../../utils/token-bucket/key-utils";
import {
  mockActualTokens,
  mockLockKey,
  mockRequestId,
  mockTokenUsageConfig,
  mockTokensReserved,
  mockUserId,
  mockWindowStartTimestamp,
} from "../../../utils/token-bucket/__tests__/token-usage-test-constants";
import { updateTokenUsage as updateTokenUsageUtil } from "../../../utils/token-bucket/update-token-usage";
import { withLock } from "../../../utils/with-lock";
import { createUpdateTokenUsageMiddleware } from "./update-token-usage";

vi.mock("../../../utils/authentication-context");
vi.mock("../../../utils/token-bucket/key-utils");
vi.mock("../../../utils/token-bucket/update-token-usage");
vi.mock("../../../utils/with-lock");

describe("createUpdateTokenUsageMiddleware", () => {
  let mockedGetAuthenticationContext: Mocked<typeof getAuthenticationContext>;
  let mockedGetTokenBucketLockKey: Mocked<typeof getTokenBucketLockKey>;
  let mockedUpdateTokenUsage: Mocked<typeof updateTokenUsageUtil>;
  let mockedWithLock: Mocked<typeof withLock>;

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;

  let mockRedisClient: Redis;
  let mockRedlockClient: Redlock;

  const executeMiddleware = async () => {
    const middleware = createUpdateTokenUsageMiddleware(
      mockRedisClient,
      mockRedlockClient,
      mockTokenUsageConfig.serviceName,
      mockTokenUsageConfig.rateLimiterName,
      mockTokenUsageConfig.lockTtlMs
    );

    await middleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );
  };

  beforeEach(() => {
    mockedGetAuthenticationContext = vi.mocked(getAuthenticationContext);
    mockedGetAuthenticationContext.mockReturnValue({
      userId: mockUserId,
    });

    mockedGetTokenBucketLockKey = vi.mocked(getTokenBucketLockKey);
    mockedGetTokenBucketLockKey.mockReturnValue(mockLockKey);

    mockedUpdateTokenUsage = vi.mocked(updateTokenUsageUtil);
    mockedUpdateTokenUsage.mockResolvedValue(undefined);

    mockedWithLock = vi.mocked(withLock);
    mockedWithLock.mockImplementation(
      async <T>(
        _redlockClient: Redlock,
        _lockKey: string,
        _lockTtl: number,
        callback: () => Promise<T>
      ): Promise<T> => {
        return await callback();
      }
    );

    mockRequest = {};
    mockResponse = {
      locals: {
        requestId: mockRequestId,
        tokenUsage: {
          tokensReserved: mockTokensReserved,
          windowStartTimestamp: mockWindowStartTimestamp,
          actualTokens: mockActualTokens,
        },
      },
    };
    mockNextFunction = vi.fn();

    mockRedisClient = createRedisClientMock();
    mockRedlockClient = createRedlockClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call updateTokenUsage and next when both tokenUsage and actualTokens are set", async () => {
    await executeMiddleware();

    // Should call next immediately (async update happens in setImmediate)
    expect(mockNextFunction).toHaveBeenCalled();

    // Wait for setImmediate to execute
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockedGetTokenBucketLockKey).toHaveBeenCalledWith(
      mockTokenUsageConfig.serviceName,
      mockTokenUsageConfig.rateLimiterName,
      mockUserId
    );
    expect(mockedWithLock).toHaveBeenCalledWith(
      mockRedlockClient,
      mockLockKey,
      mockTokenUsageConfig.lockTtlMs,
      expect.any(Function)
    );
    expect(mockedUpdateTokenUsage).toHaveBeenCalledWith(
      mockRedisClient,
      mockTokenUsageConfig.serviceName,
      mockTokenUsageConfig.rateLimiterName,
      mockUserId,
      mockActualTokens,
      mockTokensReserved,
      mockWindowStartTimestamp
    );
  });

  it("should call next without updating when tokenUsage is missing", async () => {
    mockResponse.locals = {
      requestId: mockRequestId,
      actualTokens: mockActualTokens,
    };

    await executeMiddleware();

    expect(mockNextFunction).toHaveBeenCalled();

    await new Promise((resolve) => setImmediate(resolve));

    expect(mockedUpdateTokenUsage).not.toHaveBeenCalled();
  });

  it("should call next without updating when actualTokens is missing", async () => {
    mockResponse.locals = {
      requestId: mockRequestId,
      tokenUsage: {
        tokensReserved: mockTokensReserved,
        windowStartTimestamp: mockWindowStartTimestamp,
        // actualTokens not set
      },
    };

    await executeMiddleware();

    expect(mockNextFunction).toHaveBeenCalled();

    await new Promise((resolve) => setImmediate(resolve));

    expect(mockedUpdateTokenUsage).not.toHaveBeenCalled();
  });

  it("should handle errors from updateTokenUsage without failing the request", async () => {
    const mockError = new Error("Update failed");
    mockedUpdateTokenUsage.mockRejectedValue(mockError);

    await executeMiddleware();

    expect(mockNextFunction).toHaveBeenCalled();

    await new Promise((resolve) => setImmediate(resolve));

    expect(mockedUpdateTokenUsage).toHaveBeenCalled();
    // Error should be logged but not thrown
    expect(mockNextFunction).toHaveBeenCalledTimes(1);
  });

  it("should handle errors from getAuthenticationContext without failing the request", async () => {
    const mockError = new Error("Auth error");
    mockedGetAuthenticationContext.mockImplementationOnce(() => {
      throw mockError;
    });

    await executeMiddleware();

    expect(mockNextFunction).toHaveBeenCalled();

    await new Promise((resolve) => setImmediate(resolve));

    expect(mockedUpdateTokenUsage).not.toHaveBeenCalled();
  });
});
