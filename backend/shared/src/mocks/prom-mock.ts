import { vi } from "vitest";

/**
 * Creates mock Prometheus Counter and Histogram classes with their methods.
 * Use this factory to create consistent Prometheus client mocks across test files.
 *
 * @example
 * ```ts
 * const {
 *   mockCounter,
 *   mockHistogram,
 *   mockCounterInc,
 *   mockHistogramObserve,
 *   mockRegister,
 * } = createPromClientMock();
 *
 * vi.mock("@shared/clients/prom", () => ({
 *   Counter: mockCounter,
 *   Histogram: mockHistogram,
 *   register: mockRegister,
 * }));
 *
 * // In tests
 * expect(mockCounterInc).toHaveBeenCalledWith({ label: "value" });
 * expect(mockHistogramObserve).toHaveBeenCalledWith({ label: "value" }, 1500);
 * ```
 */
export const createPromClientMock = () => {
  const mockCounterInc = vi.fn();
  const mockHistogramObserve = vi.fn();
  const mockRegisterMetrics = vi.fn();

  const mockCounter = vi.fn(() => ({
    inc: mockCounterInc,
  }));

  const mockHistogram = vi.fn(() => ({
    observe: mockHistogramObserve,
  }));

  const mockRegister = {
    metrics: mockRegisterMetrics,
    contentType: "text/plain; version=0.0.4; charset=utf-8",
  };

  return {
    mockCounter,
    mockHistogram,
    mockCounterInc,
    mockHistogramObserve,
    mockRegister,
    mockRegisterMetrics,
  };
};

/**
 * Creates a mock MetricsRecorder for testing middleware.
 * Use this factory to create consistent MetricsRecorder mocks.
 *
 * @example
 * ```ts
 * const { mockRecorder, mockRecordSuccess, mockRecordFailure } = createMetricsRecorderMock();
 *
 * const middleware = createMetricsMiddleware({
 *   operationsMap,
 *   recorder: mockRecorder,
 * });
 *
 * // In tests
 * expect(mockRecordSuccess).toHaveBeenCalledWith("operation", 2500, "request-id");
 * ```
 */
export const createMetricsRecorderMock = () => {
  const mockRecordSuccess = vi.fn();
  const mockRecordFailure = vi.fn();

  const mockRecorder = {
    recordSuccess: mockRecordSuccess,
    recordFailure: mockRecordFailure,
  };

  return {
    mockRecorder,
    mockRecordSuccess,
    mockRecordFailure,
  };
};
