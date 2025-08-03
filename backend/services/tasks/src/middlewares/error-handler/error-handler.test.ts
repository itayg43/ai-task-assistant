import { NextFunction, Request, Response } from "express";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { BaseError } from "@errors";
import { errorHandler } from "@middlewares/error-handler";

describe("errorHandler", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    // .mockReturnThis() is used so that mockRes.status() returns the mockRes object itself,
    // allowing method chaining like res.status().json().
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle base error", () => {
    const mockBaseError = new BaseError(
      "Test base error",
      StatusCodes.BAD_REQUEST
    );
    errorHandler(
      mockBaseError,
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: mockBaseError.message,
    });
  });

  it("should handle zod error", () => {
    const schema = z.object({
      name: z.string().min(2),
      age: z.number().min(18),
    });

    let mockZodError: z.ZodError;
    try {
      schema.parse({ name: "a", age: "invalid" });
    } catch (error) {
      mockZodError = error as z.ZodError;
    }

    errorHandler(
      mockZodError!,
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: expect.stringMatching(/name.*Too small.*age.*Invalid input/),
    });
  });

  it("should handle error", () => {
    const mockError = new Error("Test error");
    errorHandler(
      mockError,
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(
      StatusCodes.INTERNAL_SERVER_ERROR
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: mockError.message,
    });
  });

  it("should handle unknown error", () => {
    const unknownError = "This is not an Error object";
    errorHandler(
      unknownError,
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(
      StatusCodes.INTERNAL_SERVER_ERROR
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
    });
  });
});
