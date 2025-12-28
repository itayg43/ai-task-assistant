import { afterEach, describe, expect, it, vi } from "vitest";

import {
  recordTasksApiFailure,
  recordTasksApiSuccess,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import { register } from "@shared/clients/prom";

const { mockLoggerDebug } = vi.hoisted(() => {
  return {
    mockLoggerDebug: vi.fn(),
  };
});

vi.mock("@shared/config/create-logger", () => {
  return {
    createLogger: vi.fn(() => ({
      debug: mockLoggerDebug,
    })),
  };
});

describe("tasksMetrics", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("recordTasksApiSuccess", () => {
    it("should increment counter with success status", async () => {
      recordTasksApiSuccess("create_task", 2500, "test-request-id");

      const metrics = await register.metrics();

      expect(metrics).toContain("tasks_api_requests_total");
      expect(metrics).toContain('operation="create_task"');
      expect(metrics).toContain('status="success"');
    });

    it("should observe histogram with duration", async () => {
      recordTasksApiSuccess("create_task", 2500, "test-request-id");

      const metrics = await register.metrics();

      expect(metrics).toContain("tasks_api_request_duration_ms");
      expect(metrics).toContain('operation="create_task"');
      expect(metrics).toContain('status="success"');
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
  });

  describe("recordTasksApiFailure", () => {
    it("should increment counter with failure status", async () => {
      recordTasksApiFailure("create_task", 2500, "test-request-id");

      const metrics = await register.metrics();

      expect(metrics).toContain("tasks_api_requests_total");
      expect(metrics).toContain('operation="create_task"');
      expect(metrics).toContain('status="failure"');
    });

    it("should observe histogram with duration", async () => {
      recordTasksApiFailure("create_task", 2500, "test-request-id");

      const metrics = await register.metrics();

      expect(metrics).toContain("tasks_api_request_duration_ms");
      expect(metrics).toContain('operation="create_task"');
      expect(metrics).toContain('status="failure"');
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
  });

  describe("recordVagueInput", () => {
    it("should increment vague input counter", async () => {
      recordVagueInput("test-request-id");

      const metrics = await register.metrics();

      expect(metrics).toContain("tasks_vague_input_total");
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
