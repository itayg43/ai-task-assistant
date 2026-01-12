import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthenticationError,
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
} from "../../errors";
import { RetryConfig } from "../../types";
import { type TWithRetryContext, withRetry } from "./with-retry";

describe("withRetry", () => {
  const mockRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 10,
    backoffMultiplier: 1,
  };

  const mockContext: TWithRetryContext = {
    requestId: "test-request-id",
    operation: "test-operation",
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return result on first successful attempt", async () => {
    const mockFn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(mockRetryConfig, mockFn, mockContext);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should retry and succeed on second attempt", async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("First failure"))
      .mockResolvedValue("success");
    const result = await withRetry(mockRetryConfig, mockFn, mockContext);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("should fail after max attempts reached", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Always fails"));

    await expect(
      withRetry(mockRetryConfig, mockFn, mockContext)
    ).rejects.toThrow("Always fails");

    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  describe("non-retryable errors (400-499)", () => {
    it.each([
      {
        name: "400 BadRequestError",
        error: new BadRequestError("Input is too vague", {
          suggestions: ["Add more details"],
        }),
      },
      {
        name: "401 AuthenticationError",
        error: new AuthenticationError("Unauthorized"),
      },
      {
        name: "403 ForbiddenError",
        error: new ForbiddenError("Forbidden"),
      },
      {
        name: "404 NotFoundError",
        error: new NotFoundError("Not found"),
      },
    ])("should not retry on $name", async ({ error }) => {
      const mockFn = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(mockRetryConfig, mockFn, mockContext)
      ).rejects.toThrow(error);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("retryable errors (500+)", () => {
    it("should retry on 500 InternalError", async () => {
      const internalError = new InternalError("Internal server error");

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(internalError)
        .mockRejectedValueOnce(internalError)
        .mockResolvedValue("success");
      const result = await withRetry(mockRetryConfig, mockFn, mockContext);

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });
});
