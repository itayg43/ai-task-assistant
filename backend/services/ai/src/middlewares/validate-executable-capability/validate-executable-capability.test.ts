import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capabilities } from "@capabilities";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";
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

  beforeEach(() => {
    vi.mocked(executeCapabilityInputSchema.parse).mockReturnValue({
      body: {},
      params: {
        capability: CAPABILITY.PARSE_TASK,
      },
      query: {
        pattern: CAPABILITY_PATTERN.SYNC,
      },
    });

    mockReq = {
      params: {
        capability: CAPABILITY.PARSE_TASK,
      },
    };
    mockRes = {
      locals: {
        requestId: "test-request-id",
      },
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should validate successfully and call next()", () => {
    executeMiddleware();

    expect(executeCapabilityInputSchema.parse).toHaveBeenCalledWith(mockReq);
    expect(mockRes.locals!.capabilityConfig).toBe(capabilities["parse-task"]);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it("should call next() with NotFoundError when capability does not exist", () => {
    (capabilities as any)["parse-task"] = undefined;

    executeMiddleware();

    expect(executeCapabilityInputSchema.parse).toHaveBeenCalledWith(mockReq);
    expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
