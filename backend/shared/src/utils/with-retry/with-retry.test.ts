import { afterEach, describe, expect, it, vi } from "vitest";

import { withRetry } from "./with-retry";

describe("withRetry", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return result on first successful attempt", async () => {
    const mockFn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(
      { maxAttempts: 3, baseDelayMs: 10, backoffMultiplier: 1 },
      mockFn
    );

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should retry and succeed on second attempt", async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("First failure"))
      .mockResolvedValue("success");

    const result = await withRetry(
      { maxAttempts: 3, baseDelayMs: 10, backoffMultiplier: 1 },
      mockFn
    );

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("should fail after max attempts reached", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Always fails"));

    await expect(
      withRetry(
        { maxAttempts: 3, baseDelayMs: 10, backoffMultiplier: 1 },
        mockFn
      )
    ).rejects.toThrow("Always fails");

    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});
