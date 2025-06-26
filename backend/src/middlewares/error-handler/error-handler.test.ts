import { Request, Response, NextFunction } from "express";
import { vi, it, describe, beforeEach, afterEach, expect } from "vitest";
import { StatusCodes } from "http-status-codes";

import { errorHandler } from "./error-handler";
import { BaseError } from "@errors";
import { ErrorResponse } from "@types";

describe("errorHandler", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response<ErrorResponse>>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};

    // .mockReturnThis() is used so that mockRes.status() returns the mockRes object itself,
    // allowing method chaining like res.status().json().
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle Error", () => {
    const mockError = new Error("Test error");
    errorHandler(mockError, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(
      StatusCodes.INTERNAL_SERVER_ERROR
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      message: mockError.message,
    });
  });

  it("should handle BaseError", () => {
    const mockBaseError = new BaseError(
      "Test base error",
      StatusCodes.BAD_REQUEST
    );
    errorHandler(
      mockBaseError,
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: mockBaseError.message,
    });
  });
});
