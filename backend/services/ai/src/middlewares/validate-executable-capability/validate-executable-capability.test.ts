import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capabilities } from "@capabilities";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { executeCapabilityInputSchema } from "@schemas";
import { NotFoundError } from "@shared/errors";

vi.mock("@capabilities");

vi.mock("@schemas", () => ({
  executeCapabilityInputSchema: {
    parse: vi.fn(),
  },
}));

describe("validateExecutableCapability", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const executeMiddleware = () => {
    validateExecutableCapability(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );
  };

  const createMockRequest = (
    capability: (typeof CAPABILITY)[keyof typeof CAPABILITY]
  ) => ({
    params: {
      capability,
    },
  });

  const createMockResponse = () => ({
    locals: {
      requestId: mockAiServiceRequestId,
    },
  });

  beforeEach(() => {
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [CAPABILITY.PARSE_TASK, CAPABILITY_PATTERN.SYNC, "parse-task"],
    [CAPABILITY.PARSE_TASK, CAPABILITY_PATTERN.ASYNC, "parse-task"],
  ])(
    "should validate successfully and call next() for capability %s with pattern %s",
    (capability, pattern, capabilityKey) => {
      vi.mocked(executeCapabilityInputSchema.parse).mockReturnValue({
        params: { capability },
        query: { pattern },
      });

      mockReq = createMockRequest(capability);
      mockRes = createMockResponse();

      executeMiddleware();

      expect(executeCapabilityInputSchema.parse).toHaveBeenCalledWith(mockReq);
      expect(mockRes.locals!.capabilityConfig).toBe(
        capabilities[capabilityKey as keyof typeof capabilities]
      );
      expect(mockRes.locals!.capabilityPattern).toBe(pattern);
      expect(mockNext).toHaveBeenCalledWith();
    }
  );

  it("should call next() with NotFoundError when capability does not exist", () => {
    vi.mocked(executeCapabilityInputSchema.parse).mockReturnValue({
      params: {
        capability: CAPABILITY.PARSE_TASK,
      },
      query: {
        pattern: CAPABILITY_PATTERN.SYNC,
      },
    });

    (capabilities as any)["parse-task"] = undefined;

    mockReq = createMockRequest(CAPABILITY.PARSE_TASK);
    mockRes = createMockResponse();

    executeMiddleware();

    expect(executeCapabilityInputSchema.parse).toHaveBeenCalledWith(mockReq);
    expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
