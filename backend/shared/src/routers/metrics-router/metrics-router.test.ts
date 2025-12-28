import { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { register } from "../../clients/prom";
import { DEFAULT_ERROR_MESSAGE } from "../../constants";
import { metricsRouter } from "./metrics-router";

// Note: Can't use imported factory functions in vi.hoisted()
// because imports aren't available yet. Mocks must be inlined.
const { mockRegisterMetrics, mockLoggerError } = vi.hoisted(() => ({
  mockRegisterMetrics: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("../../clients/prom", () => ({
  register: {
    contentType: "text/plain; version=0.0.4; charset=utf-8",
    get metrics() {
      return mockRegisterMetrics;
    },
  },
}));

vi.mock("../../config/create-logger", () => ({
  createLogger: vi.fn(() => ({
    error: mockLoggerError,
  })),
}));

describe("metricsRouter", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  const callRouteHandler = async () => {
    // Access the handler from the router stack
    const route = metricsRouter.stack.find(
      (layer) => layer.route?.path === "/"
    );
    const handler = route?.route?.stack?.[0]?.handle;

    if (!handler) {
      throw new Error("Handler not found");
    }

    await handler(mockRequest as Request, mockResponse as Response, mockNext);
  };

  beforeEach(() => {
    mockRequest = {
      method: "GET",
      path: "/",
    };

    mockResponse = {
      set: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return metrics in Prometheus format", async () => {
    const mockMetricsData =
      "# HELP openai_api_requests_total Total number of OpenAI API requests\n# TYPE openai_api_requests_total counter\n";
    mockRegisterMetrics.mockResolvedValue(mockMetricsData);

    await callRouteHandler();

    expect(mockResponse.set).toHaveBeenCalledWith(
      "Content-Type",
      register.contentType
    );
    expect(mockRegisterMetrics).toHaveBeenCalledTimes(1);
    expect(mockResponse.end).toHaveBeenCalledWith(mockMetricsData);
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it("should handle errors gracefully", async () => {
    const mockError = new Error("Metrics generation failed");
    mockRegisterMetrics.mockRejectedValue(mockError);

    await callRouteHandler();

    expect(mockResponse.set).toHaveBeenCalledWith(
      "Content-Type",
      register.contentType
    );
    expect(mockRegisterMetrics).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Unexpected error in: GET /metrics",
      mockError
    );
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.end).toHaveBeenCalledWith(DEFAULT_ERROR_MESSAGE);
  });
});
