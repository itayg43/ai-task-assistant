import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import { validateCapabilityInput } from "@middlewares/validate-capability-input";
import { CAPABILITY } from "@shared/constants";
import { CapabilityConfig } from "@types";

describe("validateCapabilityInput", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;

  let mockInputSchema: z.ZodSchema<any>;
  let mockParseFunction: ReturnType<typeof vi.fn>;

  let mockCapabilityConfig: CapabilityConfig<any, any>;

  const executeMiddleware = async () => {
    await validateCapabilityInput(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );
  };

  beforeEach(() => {
    mockParseFunction = vi.fn();

    mockInputSchema = {
      parse: mockParseFunction,
    } as unknown as z.ZodSchema<any>;

    mockCapabilityConfig = {
      name: CAPABILITY.PARSE_TASK,
      handler: vi.fn(),
      inputSchema: mockInputSchema,
      outputSchema: z.object({}),
    };

    mockRequest = {
      body: {},
    };
    mockResponse = {
      locals: {
        capabilityConfig: mockCapabilityConfig,
      },
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should validate the input schema of the config, assign the body and call next", async () => {
    const mockValidatedInput = {
      body: {
        testField: "test value",
      },
    };

    mockParseFunction.mockReturnValue(mockValidatedInput);

    await executeMiddleware();

    expect(mockParseFunction).toHaveBeenCalledWith(mockRequest);
    expect(mockRequest.body).toEqual(mockValidatedInput.body);
    expect(mockNextFunction).toHaveBeenCalled();
  });

  it("should handle validation errors by calling next with the error", async () => {
    const validationError = new Error("Validation failed");
    mockParseFunction.mockImplementation(() => {
      throw validationError;
    });

    await executeMiddleware();

    expect(mockParseFunction).toHaveBeenCalledWith(mockRequest);
    expect(mockNextFunction).toHaveBeenCalledWith(validationError);
    expect(mockRequest.body).toEqual({});
  });

  it("should handle getCapabilityConfig errors by calling next with the error", async () => {
    mockResponse = {
      locals: {},
    };

    await executeMiddleware();

    expect(mockNextFunction).toHaveBeenCalledWith(expect.any(Error));
    expect(mockRequest.body).toEqual({});
  });
});
