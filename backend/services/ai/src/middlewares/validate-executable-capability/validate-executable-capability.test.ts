import { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capabilities } from "@capabilities";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";
import { mockAiServiceRequestId } from "@mocks/request-ids";

vi.mock("@capabilities");

describe("validateExecutableCapability", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  const executeMiddleware = () => {
    validateExecutableCapability(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
  };

  beforeEach(() => {
    mockRequest = {
      params: {
        capability: CAPABILITY.PARSE_TASK,
      },
      query: {
        pattern: CAPABILITY_PATTERN.SYNC,
      },
    };
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
      },
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should validate successfully and call next() for capability with sync pattern", () => {
    executeMiddleware();

    expect(mockResponse.locals!.capabilityConfig).toBe(
      capabilities["parse-task" as keyof typeof capabilities]
    );
    expect(mockResponse.locals!.capabilityValidatedQuery).toEqual({
      pattern: CAPABILITY_PATTERN.SYNC,
    });
    expect(mockNext).toHaveBeenCalledWith();
  });

  it("should validate successfully and call next() for capability with async pattern", () => {
    const mockCallbackUrl = "https://example.com/callback";

    mockRequest = {
      ...mockRequest,
      query: {
        pattern: CAPABILITY_PATTERN.ASYNC,
        callbackUrl: mockCallbackUrl,
      },
    };

    executeMiddleware();

    expect(mockResponse.locals!.capabilityConfig).toBe(
      capabilities["parse-task" as keyof typeof capabilities]
    );
    expect(mockResponse.locals!.capabilityValidatedQuery).toEqual({
      pattern: CAPABILITY_PATTERN.ASYNC,
      callbackUrl: mockCallbackUrl,
    });
    expect(mockNext).toHaveBeenCalledWith();
  });

  it("should call next() with ZodError when executeCapabilityInputSchema.parse failed", () => {
    mockRequest = {
      ...mockRequest,
      params: {
        capability: "undefined-capability",
      },
    };

    executeMiddleware();

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });
});
