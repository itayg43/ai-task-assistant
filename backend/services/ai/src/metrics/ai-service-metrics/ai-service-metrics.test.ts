import { afterEach, describe, expect, it, vi } from "vitest";

import {
  recordAiApiFailure,
  recordAiApiSuccess,
} from "@metrics/ai-service-metrics";

// Note: Can't use imported factory functions in vi.hoisted()
// because imports aren't available yet. Mocks must be inlined.
const {
  mockLoggerDebug,
  mockCounterInc,
  mockHistogramObserve,
  mockCounter,
  mockHistogram,
} = vi.hoisted(() => {
  const mockCounterInc = vi.fn();
  const mockHistogramObserve = vi.fn();
  const mockLoggerDebug = vi.fn();

  return {
    mockLoggerDebug,
    mockCounterInc,
    mockHistogramObserve,
    mockCounter: vi.fn(() => ({
      inc: mockCounterInc,
    })),
    mockHistogram: vi.fn(() => ({
      observe: mockHistogramObserve,
    })),
  };
});

vi.mock("@shared/config/create-logger", () => ({
  createLogger: vi.fn(() => ({
    debug: mockLoggerDebug,
  })),
}));

vi.mock("@shared/clients/prom", () => ({
  Counter: mockCounter,
  Histogram: mockHistogram,
  register: {
    metrics: vi.fn(),
  },
}));

describe("aiServiceMetrics", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("recordAiApiSuccess", () => {
    it("should increment counter with success status", () => {
      recordAiApiSuccess("parse-task", 2500, "test-request-id");

      expect(mockCounterInc).toHaveBeenCalledWith({
        capability: "parse-task",
        status: "success",
      });
    });

    it("should observe histogram with duration and success status", () => {
      recordAiApiSuccess("parse-task", 2500, "test-request-id");

      expect(mockHistogramObserve).toHaveBeenCalledWith(
        {
          capability: "parse-task",
          status: "success",
        },
        2500
      );
    });

    it("should log debug message with all parameters", () => {
      recordAiApiSuccess("parse-task", 2500, "test-request-id");

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Recorded AI API success metrics",
        {
          requestId: "test-request-id",
          capability: "parse-task",
          status: "success",
          durationMs: 2500,
        }
      );
    });
  });

  describe("recordAiApiFailure", () => {
    it("should increment counter with failure status", () => {
      recordAiApiFailure("parse-task", "test-request-id");

      expect(mockCounterInc).toHaveBeenCalledWith({
        capability: "parse-task",
        status: "failure",
      });
    });

    it("should not observe histogram (no duration tracking for failures)", () => {
      recordAiApiFailure("parse-task", "test-request-id");

      expect(mockHistogramObserve).not.toHaveBeenCalled();
    });

    it("should log debug message with all parameters", () => {
      recordAiApiFailure("parse-task", "test-request-id");

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Recorded AI API failure metrics",
        {
          requestId: "test-request-id",
          capability: "parse-task",
          status: "failure",
        }
      );
    });
  });
});
