import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetricsRecorder, OperationsMap } from "../../types";
import * as performanceUtils from "../../utils/performance";
import { createMetricsMiddleware } from "./metrics-middleware";

describe("createMetricsMiddleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  let mockRecorder: MetricsRecorder;
  let operationsMap: OperationsMap;

  let finishCallback: () => void;

  beforeEach(() => {
    mockRequest = {
      method: "POST",
    };

    mockResponse = {
      on: vi.fn((event: string, callback: () => void) => {
        if (event === "finish") {
          finishCallback = callback;
        }

        return mockResponse as Response;
      }),
      statusCode: 200,
      locals: {
        requestId: "test-request-id",
      },
    };

    mockNext = vi.fn();

    mockRecorder = {
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    };

    operationsMap = {
      POST: "create_task",
      GET: "get_tasks",
    };

    vi.spyOn(performanceUtils, "getStartTimestamp").mockReturnValue(1000);
    vi.spyOn(performanceUtils, "getElapsedDuration").mockReturnValue(2500);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("operation mapping", () => {
    it("should call recordSuccess with correct operation for mapped HTTP method", () => {
      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecorder.recordSuccess).toHaveBeenCalledWith(
        "create_task",
        2500,
        "test-request-id"
      );
      expect(mockRecorder.recordFailure).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should call recordFailure with correct operation for mapped HTTP method on error status", () => {
      mockResponse.statusCode = 400;

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecorder.recordFailure).toHaveBeenCalledWith(
        "create_task",
        2500,
        "test-request-id"
      );
      expect(mockRecorder.recordSuccess).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should skip metrics for unmapped HTTP methods", () => {
      mockRequest.method = "DELETE";

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.on).not.toHaveBeenCalled();
      expect(mockRecorder.recordSuccess).not.toHaveBeenCalled();
      expect(mockRecorder.recordFailure).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe("duration tracking", () => {
    it("should record accurate duration using performance utils", () => {
      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(performanceUtils.getStartTimestamp).toHaveBeenCalledTimes(1);
      expect(performanceUtils.getElapsedDuration).toHaveBeenCalledWith(1000);
      expect(mockRecorder.recordSuccess).toHaveBeenCalledWith(
        "create_task",
        2500,
        "test-request-id"
      );
    });
  });

  describe("status code handling", () => {
    it("should treat 2xx status codes as success", () => {
      mockResponse.statusCode = 201;

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecorder.recordSuccess).toHaveBeenCalled();
      expect(mockRecorder.recordFailure).not.toHaveBeenCalled();
    });

    it("should treat 4xx status codes as failure", () => {
      mockResponse.statusCode = 404;

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecorder.recordFailure).toHaveBeenCalled();
      expect(mockRecorder.recordSuccess).not.toHaveBeenCalled();
    });

    it("should treat 5xx status codes as failure", () => {
      mockResponse.statusCode = 500;

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecorder.recordFailure).toHaveBeenCalled();
      expect(mockRecorder.recordSuccess).not.toHaveBeenCalled();
    });
  });

  describe("request context", () => {
    it("should pass requestId from res.locals to recorder", () => {
      mockResponse.locals = {
        requestId: "custom-request-id-123",
      };

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecorder.recordSuccess).toHaveBeenCalledWith(
        "create_task",
        2500,
        "custom-request-id-123"
      );
    });

    it("should handle missing requestId gracefully", () => {
      mockResponse.locals = {};

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecorder.recordSuccess).toHaveBeenCalledWith(
        "create_task",
        2500,
        ""
      );
    });
  });
});
