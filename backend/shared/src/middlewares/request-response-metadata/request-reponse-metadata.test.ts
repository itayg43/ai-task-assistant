import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../../config/create-logger";
import { HEALTH_ROUTE } from "../../constants";
import { AuthenticationError } from "../../errors";
import { AuthenticationContext, Mocked } from "../../types";
import { getAuthenticationContext } from "../../utils/authentication-context";
import { requestResponseMetadata } from "./request-reponse-metadata";

vi.mock("../../config/create-logger", () => ({
  createLogger: vi.fn((_tag: string) => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));
vi.mock("../../utils/authentication-context");

describe("requestResponseMetadata", () => {
  let mockedCreateLogger: Mocked<typeof createLogger>;
  let mockedGetAuthenticationContext: Mocked<typeof getAuthenticationContext>;

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;

  const mockAuthenticationContextResponse: AuthenticationContext = {
    userId: 1,
  };

  const getLogger = () => mockedCreateLogger.mock.results[0].value;

  const createMockRequest = (originalUrl: string = "/api/test") => ({
    method: "GET",
    originalUrl,
    get: vi.fn((header: string) => {
      if (header === "User-Agent") {
        return "Mozilla/5.0 (Test Browser)";
      }
      return undefined;
    }) as any,
  });

  const createMockResponse = () => ({
    statusCode: 200,
    end: vi.fn(),
  });

  const createExpectedRequestMetadata = (
    originalUrl: string,
    authenticationContext?: AuthenticationContext
  ) => ({
    method: "GET",
    originalUrl,
    userAgent: "Mozilla/5.0 (Test Browser)",
    ...(authenticationContext && { authenticationContext }),
  });

  const createExpectedCompletionMetadata = (
    requestMetadata: any,
    statusCode: number,
    duration: string
  ) => ({
    ...requestMetadata,
    statusCode,
    duration,
  });

  const executeMiddleware = () => {
    requestResponseMetadata(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );
  };

  const simulateResponseEnd = (durationMs: number) => {
    vi.advanceTimersByTime(durationMs);
    (mockResponse.end as Function)();
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockedCreateLogger = vi.mocked(createLogger);
    mockedGetAuthenticationContext = vi.mocked(getAuthenticationContext);

    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should log request meta data including auth context when original url includes /api and authentication context is provided", () => {
    const expectedRequestMetadata = createExpectedRequestMetadata(
      "/api/test",
      mockAuthenticationContextResponse
    );

    mockedGetAuthenticationContext.mockReturnValue(
      mockAuthenticationContextResponse
    );

    executeMiddleware();

    expect(getLogger().info).toHaveBeenCalledWith(
      expect.any(String),
      expectedRequestMetadata
    );
    expect(mockNextFunction).toHaveBeenCalled();

    simulateResponseEnd(150);

    expect(getLogger().info).toHaveBeenLastCalledWith(
      expect.any(String),
      createExpectedCompletionMetadata(expectedRequestMetadata, 200, "150ms")
    );
  });

  it("should pass authentication error to the next function when original url includes /api and authentication context not provided", () => {
    const mockAuthenticationError = new AuthenticationError("");

    mockedGetAuthenticationContext.mockImplementationOnce(() => {
      throw mockAuthenticationError;
    });

    executeMiddleware();

    expect(mockNextFunction).toHaveBeenCalledWith(mockAuthenticationError);
  });

  it(`should log request meta data without auth context when original url includes ${HEALTH_ROUTE}`, () => {
    const originalUrl = `${HEALTH_ROUTE}/test`;

    mockRequest = createMockRequest(originalUrl);

    const expectedRequestMetadata = createExpectedRequestMetadata(originalUrl);

    executeMiddleware();

    expect(getLogger().info).toHaveBeenCalledWith(
      expect.any(String),
      expectedRequestMetadata
    );
    expect(mockNextFunction).toHaveBeenCalled();

    simulateResponseEnd(150);

    expect(getLogger().info).toHaveBeenLastCalledWith(
      expect.any(String),
      createExpectedCompletionMetadata(expectedRequestMetadata, 200, "150ms")
    );
  });

  it("should log completion only once when multiple calls to res.end made", () => {
    executeMiddleware();

    simulateResponseEnd(100);
    (mockResponse.end as any)("second call");

    expect(getLogger().info).toHaveBeenLastCalledWith(
      expect.any(String),
      createExpectedCompletionMetadata(
        createExpectedRequestMetadata(
          "/api/test",
          mockAuthenticationContextResponse
        ),
        200,
        "100ms"
      )
    );
  });
});
