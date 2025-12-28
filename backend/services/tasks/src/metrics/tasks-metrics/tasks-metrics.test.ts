import { afterEach, describe, expect, it, vi } from "vitest";

import {
  recordTasksApiFailure,
  recordTasksApiSuccess,
  recordVagueInput,
} from "@metrics/tasks-metrics";

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

describe("tasksMetrics", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("recordTasksApiSuccess", () => {
    it("should increment counter with success status", () => {
      recordTasksApiSuccess("create_task", 2500, "test-request-id");

      expect(mockCounterInc).toHaveBeenCalledWith({
        operation: "create_task",
        status: "success",
      });
    });

    it("should observe histogram with duration and success status", () => {
      recordTasksApiSuccess("create_task", 2500, "test-request-id");

      expect(mockHistogramObserve).toHaveBeenCalledWith(
        {
          operation: "create_task",
          status: "success",
        },
        2500
      );
    });

    it("should log debug message with all parameters", () => {
      recordTasksApiSuccess("create_task", 2500, "test-request-id");

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Recorded tasks API success metrics",
        {
          requestId: "test-request-id",
          operation: "create_task",
          status: "success",
          durationMs: 2500,
        }
      );
    });

    it("should handle get_tasks operation", () => {
      recordTasksApiSuccess("get_tasks", 750, "another-request-id");

      expect(mockCounterInc).toHaveBeenCalledWith({
        operation: "get_tasks",
        status: "success",
      });
      expect(mockHistogramObserve).toHaveBeenCalledWith(
        {
          operation: "get_tasks",
          status: "success",
        },
        750
      );
    });
  });

  describe("recordTasksApiFailure", () => {
    it("should increment counter with failure status", () => {
      recordTasksApiFailure("create_task", 2500, "test-request-id");

      expect(mockCounterInc).toHaveBeenCalledWith({
        operation: "create_task",
        status: "failure",
      });
    });

    it("should observe histogram with duration and failure status", () => {
      recordTasksApiFailure("create_task", 2500, "test-request-id");

      expect(mockHistogramObserve).toHaveBeenCalledWith(
        {
          operation: "create_task",
          status: "failure",
        },
        2500
      );
    });

    it("should log debug message with all parameters", () => {
      recordTasksApiFailure("create_task", 2500, "test-request-id");

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Recorded tasks API failure metrics",
        {
          requestId: "test-request-id",
          operation: "create_task",
          status: "failure",
          durationMs: 2500,
        }
      );
    });

    it("should handle get_tasks operation", () => {
      recordTasksApiFailure("get_tasks", 1200, "another-request-id");

      expect(mockCounterInc).toHaveBeenCalledWith({
        operation: "get_tasks",
        status: "failure",
      });
      expect(mockHistogramObserve).toHaveBeenCalledWith(
        {
          operation: "get_tasks",
          status: "failure",
        },
        1200
      );
    });
  });

  describe("recordVagueInput", () => {
    it("should increment vague input counter", () => {
      recordVagueInput("test-request-id");

      expect(mockCounterInc).toHaveBeenCalledWith();
    });

    it("should log debug message with requestId", () => {
      recordVagueInput("test-request-id");

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Recorded vague input metric",
        {
          requestId: "test-request-id",
        }
      );
    });
  });
});
