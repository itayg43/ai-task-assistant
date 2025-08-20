import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capabilities } from "@capabilities";
import { executeCapabilityInputSchema } from "@schemas";
import { NotFoundError } from "@shared/errors";
import { validateExecutableCapability } from "./validate-executable-capability";

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
    mockReq = {
      params: {
        capability: "parse-task",
      },
      body: {
        naturalLanguage: "test task",
      },
      query: {
        pattern: "sync",
      },
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should validate capability successfully and call next() without arguments", async () => {
    const mockCapabilityConfig = {
      handler: vi.fn(),
      inputSchema: {
        parse: vi.fn().mockReturnValue({
          body: {},
          params: {},
          query: {},
        }),
      },
      outputSchema: {
        parse: vi.fn(),
      },
    };

    // Mock the input schema validation to succeed
    vi.mocked(executeCapabilityInputSchema.parse).mockReturnValue({
      body: {
        naturalLanguage: "test task",
      },
      params: {
        capability: "parse-task",
      },
      query: {
        pattern: "sync",
      },
    });

    // Replace the mocked capability with our test configuration
    (capabilities as any)["parse-task"] = mockCapabilityConfig;

    await executeMiddleware();

    // Verify that the capability's input schema was called with the request data
    expect(mockCapabilityConfig.inputSchema.parse).toHaveBeenCalledWith({
      body: mockReq.body,
      params: mockReq.params,
      query: mockReq.query,
    });

    expect(mockNext).toHaveBeenCalledWith();
  });

  it("should call next() with NotFoundError when capability does not exist", async () => {
    // Simulate a missing capability by setting it to undefined
    (capabilities as any)["parse-task"] = undefined;

    await executeMiddleware();

    expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it("should call next() with validation error when capability input validation fails", async () => {
    const mockError = new Error("Validation failed");

    // Mock the input schema validation to succeed (so we can test capability validation)
    vi.mocked(executeCapabilityInputSchema.parse).mockReturnValue({
      body: {},
      params: {
        capability: "parse-task",
      },
      query: {
        pattern: "sync",
      },
    });

    // Replace with a capability that throws an error during input validation
    (capabilities as any)["parse-task"] = {
      handler: vi.fn(),
      inputSchema: {
        parse: vi.fn().mockImplementation(() => {
          throw mockError;
        }),
      },
      outputSchema: {
        parse: vi.fn(),
      },
    };

    await executeMiddleware();

    expect(mockNext).toHaveBeenCalledWith(mockError);
  });
});
