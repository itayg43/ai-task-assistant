import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WithMetricsOptions } from "../../types";
import { withMetrics } from "./with-metrics";

describe("withMetrics", () => {
  let mockOnRecordSuccess: ReturnType<typeof vi.fn>;
  let mockOnRecordFailure: ReturnType<typeof vi.fn>;
  let mockOptions: WithMetricsOptions;

  const mockOperation = "test-operation";
  const mockRequestId = "test-request-id";

  beforeEach(() => {
    mockOnRecordSuccess = vi.fn();
    mockOnRecordFailure = vi.fn();
    mockOptions = {
      operation: mockOperation,
      requestId: mockRequestId,
      onRecordSuccess: mockOnRecordSuccess,
      onRecordFailure: mockOnRecordFailure,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call onRecordSuccess with startTime and return result when the function succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("success-result");
    const beforeCall = Date.now();

    const result = await withMetrics(mockOptions, fn);

    expect(result).toBe("success-result");
    expect(mockOnRecordSuccess).toHaveBeenCalledWith(
      mockOperation,
      expect.any(Number),
      mockRequestId,
    );

    // Verify the second parameter is a recent timestamp (startTime), not a duration
    const startTime = mockOnRecordSuccess.mock.calls[0][1];
    expect(startTime).toBeGreaterThanOrEqual(beforeCall);
    expect(startTime).toBeLessThanOrEqual(Date.now());

    expect(mockOnRecordFailure).not.toHaveBeenCalled();
  });

  it("should call onRecordFailure and rethrow error when the function fails", async () => {
    const error = new Error("failed");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withMetrics(mockOptions, fn)).rejects.toThrow(error);

    expect(mockOnRecordFailure).toHaveBeenCalledWith(
      mockOperation,
      mockRequestId,
    );
    expect(mockOnRecordSuccess).not.toHaveBeenCalled();
  });
});
