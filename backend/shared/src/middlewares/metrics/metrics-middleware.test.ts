import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMetricsRecorderMock } from "../../mocks/prom-mock";
import { OperationResolver, OperationsMap } from "../../types";
import * as performanceUtils from "../../utils/performance";
import { createMetricsMiddleware } from "./metrics-middleware";

describe("createMetricsMiddleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const { mockRecorder, mockRecordSuccess, mockRecordFailure } =
    createMetricsRecorderMock();
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

  describe("static operationsMap", () => {
    it("should call recordSuccess with correct operation for mapped HTTP method", () => {
      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecordSuccess).toHaveBeenCalledWith(
        "create_task",
        2500,
        "test-request-id"
      );
      expect(mockRecordFailure).not.toHaveBeenCalled();
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

      expect(mockRecordFailure).toHaveBeenCalledWith(
        "create_task",
        "test-request-id"
      );
      expect(mockRecordSuccess).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should skip metrics for unmapped HTTP methods", () => {
      mockRequest.method = "DELETE";

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecordSuccess).not.toHaveBeenCalled();
      expect(mockRecordFailure).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe("dynamic getOperation", () => {
    it("should call recordSuccess with operation resolved from res.locals", () => {
      mockResponse.locals = {
        requestId: "test-request-id",
        capabilityConfig: { name: "parse-task" },
      };

      const getOperation: OperationResolver = (_req, res) =>
        res.locals.capabilityConfig?.name ?? null;

      const middleware = createMetricsMiddleware({
        getOperation,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecordSuccess).toHaveBeenCalledWith(
        "parse-task",
        2500,
        "test-request-id"
      );
      expect(mockRecordFailure).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should call recordFailure with operation resolved from res.locals on error status", () => {
      mockResponse.statusCode = 500;
      mockResponse.locals = {
        requestId: "test-request-id",
        capabilityConfig: { name: "parse-task" },
      };

      const getOperation: OperationResolver = (_req, res) =>
        res.locals.capabilityConfig?.name ?? null;

      const middleware = createMetricsMiddleware({
        getOperation,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecordFailure).toHaveBeenCalledWith(
        "parse-task",
        "test-request-id"
      );
      expect(mockRecordSuccess).not.toHaveBeenCalled();
    });

    it("should skip metrics when getOperation returns null", () => {
      const getOperation: OperationResolver = () => null;

      const middleware = createMetricsMiddleware({
        getOperation,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecordSuccess).not.toHaveBeenCalled();
      expect(mockRecordFailure).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should resolve operation at finish time, not at middleware invocation", () => {
      mockResponse.locals = {
        requestId: "test-request-id",
      };

      const getOperation: OperationResolver = (_req, res) =>
        res.locals.capabilityConfig?.name ?? null;

      const middleware = createMetricsMiddleware({
        getOperation,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate middleware setting locals after initial call
      mockResponse.locals!.capabilityConfig = { name: "dynamic-capability" };

      finishCallback();

      expect(mockRecordSuccess).toHaveBeenCalledWith(
        "dynamic-capability",
        2500,
        "test-request-id"
      );
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
      expect(mockRecordSuccess).toHaveBeenCalledWith(
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

      expect(mockRecordSuccess).toHaveBeenCalled();
      expect(mockRecordFailure).not.toHaveBeenCalled();
    });

    it("should treat 4xx status codes as failure", () => {
      mockResponse.statusCode = 404;

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecordFailure).toHaveBeenCalled();
      expect(mockRecordSuccess).not.toHaveBeenCalled();
    });

    it("should treat 5xx status codes as failure", () => {
      mockResponse.statusCode = 500;

      const middleware = createMetricsMiddleware({
        operationsMap,
        recorder: mockRecorder,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(mockRecordFailure).toHaveBeenCalled();
      expect(mockRecordSuccess).not.toHaveBeenCalled();
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

      expect(mockRecordSuccess).toHaveBeenCalledWith(
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

      expect(mockRecordSuccess).toHaveBeenCalledWith("create_task", 2500, "");
    });
  });
});
