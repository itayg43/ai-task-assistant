import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import { validateSchema } from "./validate-schema";

describe("validateSchema", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;

  const executeMiddleware = (schema: z.AnyZodObject) => {
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
    mockResponse = {
      locals: {},
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle success case with body, query, and params all present", () => {
    mockRequest.body = { name: "test" };
    mockRequest.query = { page: "1" };
    mockRequest.params = { id: "123" };

    const schema = z.object({
      body: z.object({
        name: z.string(),
      }),
      query: z.object({
        page: z.string().transform((val) => parseInt(val)),
      }),
      params: z.object({
        id: z.string().transform((val) => parseInt(val)),
      }),
    });

    executeMiddleware(schema);

    expect(mockRequest.body).toEqual({ name: "test" });
    expect(mockResponse.locals?.validatedQuery).toEqual({ page: 1 });
    expect(mockResponse.locals?.validatedParams).toEqual({ id: 123 });
    expect(mockNextFunction).toHaveBeenCalledTimes(1);
    expect(mockNextFunction).toHaveBeenCalledWith();
  });

  it("should not store query or params when schema only has body", () => {
    mockRequest.body = { name: "test" };
    mockRequest.query = { page: "1" };
    mockRequest.params = { id: "123" };

    const schema = z.object({
      body: z.object({
        name: z.string(),
      }),
    });

    executeMiddleware(schema);

    expect(mockRequest.body).toEqual({ name: "test" });
    expect(mockResponse.locals?.validatedQuery).toBeUndefined();
    expect(mockResponse.locals?.validatedParams).toBeUndefined();
    expect(mockNextFunction).toHaveBeenCalled();
  });

  it("should handle Zod validation errors correctly", () => {
    mockRequest.body = {
      name: "n",
    };

    const schema = z.object({
      body: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
      }),
    });

    executeMiddleware(schema);

    expect(mockNextFunction).toHaveBeenCalledTimes(1);
    expect(mockNextFunction).toHaveBeenCalledWith(expect.any(z.ZodError));
  });
});
