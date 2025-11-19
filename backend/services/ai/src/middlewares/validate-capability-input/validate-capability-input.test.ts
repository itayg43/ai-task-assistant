import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { validateCapabilityInput } from "@middlewares/validate-capability-input";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { AnyCapabilityConfig } from "@types";

describe("validateCapabilityInput", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;

  let mockInputSchema: z.ZodSchema<any>;
  let mockInputSchemaParseFunction: ReturnType<typeof vi.fn>;
  let mockOutputSchema: z.ZodSchema<any>;
  let mockOutputSchemaParseFunction: ReturnType<typeof vi.fn>;

  let mockCapabilityConfig: AnyCapabilityConfig;

  const executeMiddleware = async () => {
    await validateCapabilityInput(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );
  };

  beforeEach(() => {
    mockInputSchemaParseFunction = vi.fn();
    mockInputSchema = {
      parse: mockInputSchemaParseFunction,
    } as unknown as z.ZodSchema<any>;
    mockOutputSchemaParseFunction = vi.fn();
    mockOutputSchema = {
      parse: mockOutputSchemaParseFunction,
    } as unknown as z.ZodSchema<any>;

    mockCapabilityConfig = {
      ...mockParseTaskCapabilityConfig,
      inputSchema: mockInputSchema,
      outputSchema: mockOutputSchema,
    };

    mockRequest = {
      body: {},
    };
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
        capabilityConfig: mockCapabilityConfig,
      },
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should validate the input schema of the config, store the validated input and call next", async () => {
    mockInputSchemaParseFunction.mockReturnValue(mockParseTaskValidatedInput);

    await executeMiddleware();

    expect(mockInputSchemaParseFunction).toHaveBeenCalledWith(mockRequest);
    expect(mockResponse.locals?.capabilityValidatedInput).toEqual(
      mockParseTaskValidatedInput
    );
    expect(mockNextFunction).toHaveBeenCalled();
  });

  it("should handle validation errors by calling next with the error", async () => {
    const validationError = new Error("Validation failed");
    mockInputSchemaParseFunction.mockImplementation(() => {
      throw validationError;
    });

    await executeMiddleware();

    expect(mockInputSchemaParseFunction).toHaveBeenCalledWith(mockRequest);
    expect(mockNextFunction).toHaveBeenCalledWith(validationError);
  });

  it("should handle getCapabilityConfig errors by calling next with the error", async () => {
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
      },
    };

    await executeMiddleware();

    expect(mockNextFunction).toHaveBeenCalledWith(expect.any(Error));
  });
});
