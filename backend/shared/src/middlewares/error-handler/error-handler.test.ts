import { AxiosError, AxiosResponse } from "axios";
import { NextFunction, Request, Response } from "express";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

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
      });
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
        message: expect.stringMatching(/name.*Too small.*age.*Invalid input/),
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
      });
    });
  });
});
