import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { validateSchema } from "@middlewares/validate-schema";

describe("validateSchema", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response> = {};
  let mockNextFunction: NextFunction;

  const executeMiddleware = (schema: z.ZodSchema) => {
    const middleware = validateSchema(schema);

    middleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );
  };

  beforeEach(() => {
    mockRequest = {
      body: {},
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call next when validation passes and update req.body", () => {
    mockRequest.body = {
      name: "  test name  ",
    };

    const schema = z.object({
      body: z.object({
        name: z.string().transform((val) => val.trim()),
      }),
    });

    executeMiddleware(schema);

    expect(mockRequest.body).toEqual({
      name: "test name",
    });
    expect(mockNextFunction).toHaveBeenCalled();
  });

  it("should pass zod error to next when validation fails", () => {
    mockRequest.body = {
      name: "n",
    };

    const schema = z.object({
      body: z.object({
        name: z.string().min(2),
      }),
    });

    executeMiddleware(schema);

    expect(mockNextFunction).toHaveBeenCalledWith(expect.any(z.ZodError));
  });
});
