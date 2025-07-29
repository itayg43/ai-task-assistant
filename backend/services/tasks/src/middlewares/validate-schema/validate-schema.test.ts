import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { validateSchema } from "@middlewares/validate-schema";

describe("validateSchema", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
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
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call next when validation passes and update req.body", () => {
    const originalBody = {
      name: "name",
    };
    mockRequest.body = originalBody;

    const schema = z.object({
      body: z.object({
        name: z.string(),
      }),
    });

    executeMiddleware(schema);

    expect(mockRequest.body).toStrictEqual(originalBody);
    expect(mockNextFunction).toHaveBeenCalled();
  });

  it("should update req.body with transformed values when using transforms", () => {
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

  it("should return status 400 with formatted error when validation fails", () => {
    mockRequest.body = {
      name: "n",
    };

    const schema = z.object({
      body: z.object({
        name: z.string().min(2),
      }),
    });

    executeMiddleware(schema);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: expect.any(String),
    });
    expect(mockNextFunction).not.toHaveBeenCalled();
  });
});
