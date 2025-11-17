import { AxiosError, AxiosResponse } from "axios";
import { NextFunction, Request, Response } from "express";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import { BaseError } from "../../errors";
import { errorHandler } from "./error-handler";

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
      locals: {},
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("BaseError", () => {
    it("should return BaseError status code and message", () => {
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
        message: "Test base error",
        requestId: undefined,
      });
    });

    it("should filter sensitive fields from BaseError context", () => {
      const mockBaseError = new BaseError(
        "Test base error",
        StatusCodes.BAD_REQUEST,
        {
          password: "secret123",
          apiKey: "key123",
          token: "token123",
          secret: "secret",
          message: "should be filtered",
          requestId: "test-id",
          openaiRequestId: "openai-id",
        }
      );

      errorHandler(
        mockBaseError,
        mockRequest as Request,
        mockResponse as Response,
        mockNextFunction
      );

      const responseCall = mockResponse.json as ReturnType<typeof vi.fn>;
      const responseData = responseCall.mock.calls[0][0];

      // context.message should be filtered, but error.message should remain
      // (message property exists but it's the error message, not context.message)
      expect(responseData.message).toBe("Test base error");
      // Sensitive fields from context should be filtered
      expect(responseData).not.toHaveProperty("password");
      expect(responseData).not.toHaveProperty("apiKey");
      expect(responseData).not.toHaveProperty("token");
      expect(responseData).not.toHaveProperty("secret");
    });

    it("should preserve safe fields in BaseError context", () => {
      const mockBaseError = new BaseError(
        "Test base error",
        StatusCodes.BAD_REQUEST,
        {
          requestId: "test-id",
          openaiRequestId: "openai-id",
          capability: "parse-task",
          aiServiceRequestId: "ai-service-id",
        }
      );

      errorHandler(
        mockBaseError,
        mockRequest as Request,
        mockResponse as Response,
        mockNextFunction
      );

      const responseCall = mockResponse.json as ReturnType<typeof vi.fn>;
      const responseData = responseCall.mock.calls[0][0];

      expect(responseData.message).toBe("Test base error");
      expect(responseData.requestId).toBe("test-id");
      expect(responseData.openaiRequestId).toBe("openai-id");
      expect(responseData.capability).toBe("parse-task");
      expect(responseData.aiServiceRequestId).toBe("ai-service-id");
    });

    it("should not allow context.message to overwrite error message", () => {
      const mockBaseError = new BaseError(
        "Error message",
        StatusCodes.BAD_REQUEST,
        {
          message: "Context message",
          requestId: "test",
        }
      );

      errorHandler(
        mockBaseError,
        mockRequest as Request,
        mockResponse as Response,
        mockNextFunction
      );

      const responseCall = mockResponse.json as ReturnType<typeof vi.fn>;
      const responseData = responseCall.mock.calls[0][0];

      expect(responseData.message).toBe("Error message");
    });
  });

  describe("ZodError", () => {
    it("should return BAD_REQUEST status with formatted validation errors", () => {
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
        message: expect.any(String),
        requestId: undefined,
      });
    });
  });

  describe("AxiosError", () => {
    it("should return response status and message when available", () => {
      const mockAxiosError = new AxiosError(
        undefined,
        undefined,
        undefined,
        undefined,
        {
          status: StatusCodes.NOT_FOUND,
          data: {
            message: "Resource not found",
          },
        } as AxiosResponse
      );

      errorHandler(
        mockAxiosError,
        mockRequest as Request,
        mockResponse as Response,
        mockNextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Resource not found",
        requestId: undefined,
      });
    });

    it("should fallback to default status and message when response is undefined", () => {
      const mockAxiosError = new AxiosError("Network Error");

      errorHandler(
        mockAxiosError,
        mockRequest as Request,
        mockResponse as Response,
        mockNextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
        requestId: undefined,
      });
    });
  });

  describe("Error", () => {
    it("should return INTERNAL_SERVER_ERROR status with error message", () => {
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
        message: "Test error",
        requestId: undefined,
      });
    });
  });

  describe("Unknown error", () => {
    it("should return INTERNAL_SERVER_ERROR status with default message for non-Error objects", () => {
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
        requestId: undefined,
      });
    });
  });
});
