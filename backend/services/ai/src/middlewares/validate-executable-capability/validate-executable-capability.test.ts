import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capabilities } from "@capabilities";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";
import { executeCapabilityInputSchema } from "@schemas";
import { NotFoundError } from "@shared/errors";
import { Mocked } from "@shared/types";

vi.mock("@capabilities", () => ({
  capabilities: {
    "parse-task": {
      handler: vi.fn(),
      inputSchema: {
        parse: vi.fn(),
      },
      outputSchema: {
        parse: vi.fn(),
      },
    },
  },
}));

vi.mock("@schemas", () => ({
  executeCapabilityInputSchema: {
    parse: vi.fn(),
  },
}));

describe("validateExecutableCapability", () => {
  let mockedExecuteCapabilityInputSchemaParse: Mocked<
    typeof executeCapabilityInputSchema.parse
  >;

  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const executeMiddleware = async () => {
    await validateExecutableCapability(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );
  };

  beforeEach(() => {
    mockedExecuteCapabilityInputSchemaParse = vi.mocked(
      executeCapabilityInputSchema.parse
    );
    mockedExecuteCapabilityInputSchemaParse.mockReturnValue({
      body: {},
      params: {
        capability: CAPABILITY.PARSE_TASK,
      },
      query: {
        pattern: CAPABILITY_PATTERN.SYNC,
      },
    });

    mockReq = {
      body: {
        naturalLanguage: "test task",
      },
      params: {
        capability: CAPABILITY.PARSE_TASK,
      },
      query: {
        pattern: CAPABILITY_PATTERN.SYNC,
      },
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should validate successfully and call next()", async () => {
    (capabilities as any)["parse-task"] = {};

    await executeMiddleware();

    expect(executeCapabilityInputSchema.parse).toHaveBeenCalledWith(mockReq);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it("should call next() with NotFoundError when capability does not exist", async () => {
    (capabilities as any)["parse-task"] = undefined;

    await executeMiddleware();

    expect(executeCapabilityInputSchema.parse).toHaveBeenCalledWith(mockReq);
    expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
