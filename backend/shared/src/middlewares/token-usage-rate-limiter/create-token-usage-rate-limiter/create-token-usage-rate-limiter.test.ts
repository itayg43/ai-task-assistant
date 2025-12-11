import { NextFunction, Request, Response } from "express";
import Redis from "ioredis";
import Redlock from "redlock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthenticationError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../../../errors";
import { createRedisClientMock } from "../../../mocks/redis-mock";
import { createRedlockClientMock } from "../../../mocks/redlock-mock";
import type { TokenUsageRateLimiterConfig } from "../../../types";
import { Mocked } from "../../../types";
import { getAuthenticationContext } from "../../../utils/authentication-context";
import {
  mockLockKey,
  mockRequestId,
  mockTokenUsageAllowedResponse,
  mockTokenUsageConfig,
  mockTokenUsageDeniedResponse,
  mockUserId,
} from "../../../utils/token-bucket/__tests__/token-usage-test-constants";
import { getTokenBucketLockKey } from "../../../utils/token-bucket/key-utils";
import { processTokenUsage } from "../../../utils/token-bucket/process-token-usage";
import { withLock } from "../../../utils/with-lock";
import { createTokenUsageRateLimiter } from "./create-token-usage-rate-limiter";

vi.mock("../../../utils/authentication-context");
vi.mock("../../../utils/token-bucket/key-utils");
vi.mock("../../../utils/token-bucket/process-token-usage");
vi.mock("../../../utils/with-lock");

describe("createTokenUsageRateLimiter", () => {
  let mockedGetAuthenticationContext: Mocked<typeof getAuthenticationContext>;
  let mockedGetTokenBucketLockKey: Mocked<typeof getTokenBucketLockKey>;
  let mockedProcessTokenUsage: Mocked<typeof processTokenUsage>;
  let mockedWithLock: Mocked<typeof withLock>;

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;

  let mockRedisClient: Redis;
  let mockRedlockClient: Redlock;

  const executeMiddleware = async (
    config: TokenUsageRateLimiterConfig = mockTokenUsageConfig
  ) => {
    const testRateLimiter = createTokenUsageRateLimiter(
      mockRedisClient,
      mockRedlockClient,
      config
    );

    await testRateLimiter(
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

    mockedProcessTokenUsage = vi.mocked(processTokenUsage);

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

    mockRequest = {
      method: "GET",
      originalUrl: "testUrl",
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      locals: {
        requestId: mockRequestId,
      },
    };
    mockNextFunction = vi.fn();

    mockRedisClient = createRedisClientMock();
    mockRedlockClient = createRedlockClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call next and store reservation data when the request is allowed", async () => {
    mockedProcessTokenUsage.mockResolvedValue(mockTokenUsageAllowedResponse);

    await executeMiddleware();

    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
    expect(mockNextFunction).toHaveBeenCalled();
    expect(mockResponse.locals?.tokenUsage).toEqual({
      tokensReserved: mockTokenUsageAllowedResponse.tokensReserved,
      windowStartTimestamp: mockTokenUsageAllowedResponse.windowStartTimestamp,
    });
  });

  it("should handle AuthenticationError thrown by getAuthenticationContext", async () => {
    const mockAuthenticationError = new AuthenticationError("");
    mockedGetAuthenticationContext.mockImplementationOnce(() => {
      throw mockAuthenticationError;
    });

    await executeMiddleware();

    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
    expect(mockNextFunction).toHaveBeenCalledWith(mockAuthenticationError);
  });

  it("should handle ServiceUnavailableError thrown by withLock/processTokenUsage", async () => {
    mockedProcessTokenUsage.mockRejectedValue(new Error(""));

    await executeMiddleware();

    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
    expect(mockNextFunction).toHaveBeenCalledWith(
      expect.any(ServiceUnavailableError)
    );
  });

  it("should throw TooManyRequestsError when request is not allowed", async () => {
    mockedProcessTokenUsage.mockResolvedValue(mockTokenUsageDeniedResponse);

    await executeMiddleware();

    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
    expect(mockNextFunction).toHaveBeenCalledWith(
      expect.any(TooManyRequestsError)
    );
    expect(mockResponse.locals?.tokenUsage).toBeUndefined();
  });
});
