import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TokenBucketRateLimiterConfig } from "@types";
import { getTokenBucketLockKey, processTokenBucket, withLock } from "@utils";
import { createTokenBucketLimiter } from "./create-token-bucket-limiter";

vi.mock("@utils/token-bucket/key-utils", () => ({
  getTokenBucketLockKey: vi.fn(),
}));

vi.mock(
  "@utils/token-bucket/process-token-bucket/process-token-bucket",
  () => ({
    processTokenBucket: vi.fn(),
  })
);

vi.mock("@utils/with-lock/with-lock", () => ({
  withLock: vi.fn(),
}));

describe("createTokenBucketLimiter", () => {
  const mockedGetTokenBucketLockKey = vi.mocked(getTokenBucketLockKey);
  const mockedProcessTokenBucket = vi.mocked(processTokenBucket);
  const mockedWithLock = vi.mocked(withLock);

  const mockRequest: Partial<Request> = {
    method: "GET",
    originalUrl: "testUrl",
  };
  const mockResponse: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const mockNextFunction: NextFunction = vi.fn();

  const mockLockKey = "process:token:bucket:lock";
  const mockConfig: TokenBucketRateLimiterConfig = {
    rateLimiterName: "test",
    bucketSize: 100,
    refillRate: 1,
    bucketTtlSeconds: 100,
    lockTtlMs: 500,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call next when the request is allowed", async () => {
    mockedGetTokenBucketLockKey.mockReturnValue(mockLockKey);

    mockedProcessTokenBucket.mockResolvedValue({
      allowed: true,
      tokensLeft: 1,
    });

    mockedWithLock.mockImplementation(async (_lockKey, _lockTtl, callback) => {
      return await callback();
    });

    const testRateLimiter = createTokenBucketLimiter(mockConfig);
    await testRateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
    expect(mockNextFunction).toHaveBeenCalled();
  });

  it(`should return response with ${StatusCodes.TOO_MANY_REQUESTS} status when request is not allowed`, async () => {
    mockedGetTokenBucketLockKey.mockReturnValue(mockLockKey);

    mockedProcessTokenBucket.mockResolvedValue({
      allowed: false,
      tokensLeft: 0,
    });

    mockedWithLock.mockImplementation(async (_lockKey, _lockTtl, callback) => {
      return await callback();
    });

    const testRateLimiter = createTokenBucketLimiter(mockConfig);
    await testRateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(
      StatusCodes.TOO_MANY_REQUESTS
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: expect.any(String),
    });
  });

  it(`should return response with ${StatusCodes.SERVICE_UNAVAILABLE} status when error occurred`, async () => {
    mockedGetTokenBucketLockKey.mockReturnValue(mockLockKey);

    mockedProcessTokenBucket.mockRejectedValue(undefined);

    mockedWithLock.mockImplementation(async (_lockKey, _lockTtl, callback) => {
      return await callback();
    });

    const testRateLimiter = createTokenBucketLimiter(mockConfig);
    await testRateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(
      StatusCodes.SERVICE_UNAVAILABLE
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: expect.any(String),
    });
  });
});
