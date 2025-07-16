import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { createLogger } from "@config/logger";
import { requestResponseMetadata } from "@middlewares/request-response-metadata/request-reponse-metadata";

vi.mock("@config/logger");

describe("requestResponseMetadata", () => {
  let mockedLogger: ReturnType<typeof createLogger>;

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.useFakeTimers();

    mockedLogger = createLogger("test");

    mockRequest = {
      method: "GET",
      url: "/api/test",
      get: vi.fn((header: string) => {
        if (header === "User-Agent") {
          return "Mozilla/5.0 (Test Browser)";
        }
        return undefined;
      }) as any,
    };
    mockResponse = {
      statusCode: 200,
      end: vi.fn(),
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should log incoming request with correct metadata", () => {
    requestResponseMetadata(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockedLogger.info).toHaveBeenCalledWith("Incoming request", {
      method: "GET",
      url: "/api/test",
      userAgent: "Mozilla/5.0 (Test Browser)",
    });
  });

  it("should call next function", () => {
    requestResponseMetadata(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
  });

  it("should log request completion with duration when response ends", () => {
    requestResponseMetadata(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    vi.advanceTimersByTime(150);

    (mockResponse.end as Function)();

    expect(mockedLogger.info).toHaveBeenCalledTimes(2);
    expect(mockedLogger.info).toHaveBeenLastCalledWith("Request completed", {
      method: "GET",
      url: "/api/test",
      userAgent: "Mozilla/5.0 (Test Browser)",
      statusCode: 200,
      duration: "150ms",
    });
  });

  it("should handle missing User-Agent header", () => {
    (mockRequest.get as Mock).mockReturnValue(undefined);

    requestResponseMetadata(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockedLogger.info).toHaveBeenCalledWith("Incoming request", {
      method: "GET",
      url: "/api/test",
      userAgent: undefined,
    });
  });

  it("should handle multiple calls to res.end", () => {
    requestResponseMetadata(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    vi.advanceTimersByTime(100);
    (mockResponse.end as any)("first call");

    vi.advanceTimersByTime(50);
    (mockResponse.end as any)("second call");

    // Should only log completion once (first call)
    expect(mockedLogger.info).toHaveBeenCalledTimes(2);
    expect(mockedLogger.info).toHaveBeenLastCalledWith("Request completed", {
      method: "GET",
      url: "/api/test",
      userAgent: "Mozilla/5.0 (Test Browser)",
      statusCode: 200,
      duration: "100ms",
    });
  });
});
