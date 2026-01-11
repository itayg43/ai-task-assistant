import { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capabilities } from "@capabilities";
import { CAPABILITY } from "@constants";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";
import { mockCallbackUrl } from "@mocks/callbackUrl-mocks";
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
        callbackUrl: mockCallbackUrl,
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

  it("should validate successfully and call next() for capability with callbackUrl", () => {
    executeMiddleware();

    expect(mockResponse.locals!.capabilityConfig).toBe(
      capabilities["parse-task" as keyof typeof capabilities]
    );
    expect(mockResponse.locals!.capabilityValidatedQuery).toEqual({
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
