import { ResourceLockedError } from "redlock";
import { afterEach, describe, expect, it, Mock, vi } from "vitest";

import { redlock } from "@clients";
import { withLock } from "./with-lock";

vi.mock("@clients", () => ({
  redlock: {
    acquire: vi.fn(),
  },
}));

describe("withLock", () => {
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should acquire lock, execute fn and release lock", async () => {
    (redlock.acquire as Mock).mockResolvedValue({
      release: mockRelease,
    });

    const result = await withLock(mockLockKey, mockLockDuration, mockFn);

    expect(redlock.acquire).toHaveBeenCalledWith(
      [mockLockKey],
      mockLockDuration
    );
    expect(mockFn).toHaveBeenCalled();
    expect(result).toBe(mockFnResult);
    expect(mockRelease).toHaveBeenCalled();
  });

  it("should acquire lock, execute fn and fail to release lock", async () => {
    (redlock.acquire as Mock).mockResolvedValue({
      release: mockReleaseFail,
    });

    const result = await withLock(mockLockKey, mockLockDuration, mockFn);

    expect(redlock.acquire).toHaveBeenCalledWith(
      [mockLockKey],
      mockLockDuration
    );
    expect(mockFn).toHaveBeenCalled();
    expect(result).toBe(mockFnResult);
    expect(mockReleaseFail).toHaveBeenCalled();
  });

  it("should acquire lock, fail to execute fn and release lock", async () => {
    (redlock.acquire as Mock).mockResolvedValue({
      release: mockRelease,
    });

    await expect(
      withLock(mockLockKey, mockLockDuration, mockFnFail)
    ).rejects.toThrow(mockFailFnExecutionError);
    expect(redlock.acquire).toHaveBeenCalledWith(
      [mockLockKey],
      mockLockDuration
    );
    expect(mockFnFail).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalled();
  });

  it("should acquire lock, fail to execute fn and fail to release lock", async () => {
    (redlock.acquire as Mock).mockResolvedValue({
      release: mockReleaseFail,
    });

    await expect(
      withLock(mockLockKey, mockLockDuration, mockFnFail)
    ).rejects.toThrow(mockFailFnExecutionError);
    expect(redlock.acquire).toHaveBeenCalledWith(
      [mockLockKey],
      mockLockDuration
    );
    expect(mockFnFail).toHaveBeenCalled();
    expect(mockReleaseFail).toHaveBeenCalled();
  });

  it("should fail to acquire lock, not execute fn and not release lock", async () => {
    (redlock.acquire as Mock).mockRejectedValue(mockFailAcquireLockError);

    await expect(
      withLock(mockLockKey, mockLockDuration, mockFn)
    ).rejects.toThrow(mockFailAcquireLockError);
    expect(redlock.acquire).toHaveBeenCalledWith(
      [mockLockKey],
      mockLockDuration
    );
    expect(mockFn).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });
});
