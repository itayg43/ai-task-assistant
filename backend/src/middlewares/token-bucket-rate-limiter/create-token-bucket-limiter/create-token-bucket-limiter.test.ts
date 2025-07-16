import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenBucketLimiter } from "@middlewares/token-bucket-rate-limiter/create-token-bucket-limiter";
import { Mocked, TokenBucketRateLimiterConfig } from "@types";
import { getTokenBucketLockKey } from "@utils/token-bucket/key-utils";
import { processTokenBucket } from "@utils/token-bucket/process-token-bucket";
import { withLock } from "@utils/with-lock";

vi.mock("@utils/token-bucket/key-utils");
vi.mock("@utils/token-bucket/process-token-bucket");
vi.mock("@utils/with-lock");

describe("createTokenBucketLimiter", () => {
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

  beforeEach(() => {
    mockedGetTokenBucketLockKey = vi.mocked(getTokenBucketLockKey);
    mockedProcessTokenBucket = vi.mocked(processTokenBucket);
    mockedWithLock = vi.mocked(withLock);

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
