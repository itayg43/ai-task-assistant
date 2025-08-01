import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationError } from "@errors";
import { createTokenBucketLimiter } from "@middlewares/token-bucket-rate-limiter/create-token-bucket-limiter";
import { Mocked, TokenBucketRateLimiterConfig } from "@types";
import { getAuthenticationContext } from "@utils/authentication-context";
import { getTokenBucketLockKey } from "@utils/token-bucket/key-utils";
import { processTokenBucket } from "@utils/token-bucket/process-token-bucket";
import { withLock } from "@utils/with-lock";

vi.mock("@utils/authentication-context");
vi.mock("@utils/token-bucket/key-utils");
vi.mock("@utils/token-bucket/process-token-bucket");
vi.mock("@utils/with-lock");

describe("createTokenBucketLimiter", () => {
  let mockedGetAuthenticationContext: Mocked<typeof getAuthenticationContext>;
  let mockedGetTokenBucketLockKey: Mocked<typeof getTokenBucketLockKey>;
  let mockedProcessTokenBucket: Mocked<typeof processTokenBucket>;
  let mockedWithLock: Mocked<typeof withLock>;

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;

  const mockLockKey = "process:token:bucket:lock";
  const mockConfig: TokenBucketRateLimiterConfig = {
    rateLimiterName: "test",
    bucketSize: 100,
    refillRate: 1,
    bucketTtlSeconds: 100,
    lockTtlMs: 500,
  };

  const executeMiddleware = async (
    config: TokenBucketRateLimiterConfig = mockConfig
  ) => {
    const testRateLimiter = createTokenBucketLimiter(config);

    await testRateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );
  };

  beforeEach(() => {
    mockedGetAuthenticationContext = vi.mocked(getAuthenticationContext);
    mockedGetAuthenticationContext.mockReturnValue({
      userId: 1,
    });
    mockedGetTokenBucketLockKey = vi.mocked(getTokenBucketLockKey);
    mockedGetTokenBucketLockKey.mockReturnValue(mockLockKey);
    mockedProcessTokenBucket = vi.mocked(processTokenBucket);
    mockedWithLock = vi.mocked(withLock);
    mockedWithLock.mockImplementation(async (_lockKey, _lockTtl, callback) => {
      return await callback();
    });

    mockRequest = {
      method: "GET",
      originalUrl: "testUrl",
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call next when the request is allowed", async () => {
    mockedProcessTokenBucket.mockResolvedValue({
      allowed: true,
      tokensLeft: 1,
    });

    await executeMiddleware();

    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
    expect(mockNextFunction).toHaveBeenCalled();
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

  it(`should return response with ${StatusCodes.TOO_MANY_REQUESTS} status when request is not allowed`, async () => {
    mockedProcessTokenBucket.mockResolvedValue({
      allowed: false,
      tokensLeft: 0,
    });

    await executeMiddleware();

    expect(mockResponse.status).toHaveBeenCalledWith(
      StatusCodes.TOO_MANY_REQUESTS
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: expect.any(String),
    });
  });

  it(`should return response with ${StatusCodes.SERVICE_UNAVAILABLE} status when error occurred`, async () => {
    mockedProcessTokenBucket.mockRejectedValue(undefined);

    await executeMiddleware();

    expect(mockResponse.status).toHaveBeenCalledWith(
      StatusCodes.SERVICE_UNAVAILABLE
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: expect.any(String),
    });
  });
});
