import { afterEach, describe, expect, it, vi } from "vitest";

import { BadRequestError } from "../../errors";
import { RetryConfig } from "../../types";
import { withRetry } from "./with-retry";

describe("withRetry", () => {
  const mockRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 10,
    backoffMultiplier: 1,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return result on first successful attempt", async () => {
    const mockFn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(mockRetryConfig, mockFn);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should retry and succeed on second attempt", async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("First failure"))
      .mockResolvedValue("success");

    const result = await withRetry(mockRetryConfig, mockFn);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("should fail after max attempts reached", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Always fails"));

    await expect(withRetry(mockRetryConfig, mockFn)).rejects.toThrow(
      "Always fails"
    );

    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it("should not retry on 400 BadRequestError", async () => {
    const badRequestError = new BadRequestError("Input is too vague", {
      suggestions: ["Add more details"],
    });

    const mockFn = vi.fn().mockRejectedValue(badRequestError);

    await expect(withRetry(mockRetryConfig, mockFn)).rejects.toThrow(
      badRequestError
    );

    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
