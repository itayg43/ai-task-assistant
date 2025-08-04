import Redlock, { ResourceLockedError } from "redlock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRedlockClientMock,
  setupAcquireMock,
} from "../../mocks/redlock-mock";
import { withLock } from "./with-lock";

/**
 * - Separate test for lock acquisition failure.
 * - Table-driven tests for successful lock acquisition scenarios.
 */

describe("withLock", () => {
  let mockRedlockClient: Redlock;

  const mockLockKey = "mockLockKey";
  const mockLockDuration = 500;

  const mockFnResult = "mockResult";
  const mockFn = vi.fn().mockResolvedValue(mockFnResult);
  const mockFailFnExecutionError = new Error("Failed to execute fn");
  const mockFnFail = vi.fn().mockRejectedValue(mockFailFnExecutionError);

  const mockRelease = vi.fn().mockResolvedValue(undefined);
  const mockFailReleaseLockError = new Error("Failed to release lock");
  const mockReleaseFail = vi.fn().mockRejectedValue(mockFailReleaseLockError);

  const mockFailAcquireLockError = new ResourceLockedError(
    "Failed to acquire lock"
  );

  const shouldAcquireLockCases = [
    {
      description: "should acquire lock, execute fn and release lock",
      mockAcquire: {
        release: mockRelease,
      },
      _mockFn: mockFn,
      expectedResult: mockFnResult,
      expectedError: undefined,
    },
    {
      description: "should acquire lock, fail to execute fn and release lock",
      mockAcquire: {
        release: mockRelease,
      },
      _mockFn: mockFnFail,
      expectedResult: undefined,
      expectedError: mockFailFnExecutionError,
    },
    {
      description: "should acquire lock, execute fn and fail to release lock",
      mockAcquire: {
        release: mockReleaseFail,
      },
      _mockFn: mockFn,
      expectedResult: mockFnResult,
      expectedError: undefined,
    },
    {
      description:
        "should acquire lock, fail to execute fn and fail to release lock",
      mockAcquire: {
        release: mockReleaseFail,
      },
      _mockFn: mockFnFail,
      expectedResult: undefined,
      expectedError: mockFailFnExecutionError,
    },
  ] as const;

  beforeEach(() => {
    mockRedlockClient = createRedlockClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fail to acquire lock, not execute fn and not release lock", async () => {
    setupAcquireMock(mockRedlockClient, mockFailAcquireLockError, false);

    await expect(
      withLock(mockRedlockClient, mockLockKey, mockLockDuration, mockFn)
    ).rejects.toThrow(mockFailAcquireLockError);
    expect(mockRedlockClient.acquire).toHaveBeenCalledWith(
      [mockLockKey],
      mockLockDuration
    );
    expect(mockFn).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  // Table-driven tests for successful lock acquisition
  it.each(shouldAcquireLockCases)(
    "$description",
    async ({ mockAcquire, _mockFn, expectedResult, expectedError }) => {
      let result;

      setupAcquireMock(mockRedlockClient, mockAcquire);

      if (expectedError) {
        await expect(
          withLock(mockRedlockClient, mockLockKey, mockLockDuration, _mockFn)
        ).rejects.toThrow(expectedError);
      } else {
        result = await withLock(
          mockRedlockClient,
          mockLockKey,
          mockLockDuration,
          _mockFn
        );
      }

      expect(mockRedlockClient.acquire).toHaveBeenCalledWith(
        [mockLockKey],
        mockLockDuration
      );
      expect(_mockFn).toHaveBeenCalled();
      expect(result).toBe(expectedResult);
      expect(mockAcquire.release).toHaveBeenCalled();
    }
  );
});
