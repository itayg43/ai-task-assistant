import { AxiosError, AxiosResponse } from "axios";
import { StatusCodes } from "http-status-codes";
import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";

import {
  DEFAULT_ERROR_MESSAGE,
  ZOD_SCHEMA_VALIDATION_ERROR,
} from "../../constants";
import { BadRequestError, InternalError } from "../../errors";
import {
  extractErrorInfo,
  formatZodErrors,
  isNonRetryableError,
} from "./extract-error-info";

describe("extractErrorInfo", () => {
  describe("BaseError", () => {
    it("should extract status code and message from BaseError", () => {
      const error = new BadRequestError("Test error", {
        key: "value",
      });

      const result = extractErrorInfo(error);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      expect(result.message).toBe("Test error");
      expect(result.context).toEqual({
        key: "value",
      });
    });

    it("should handle BaseError without context", () => {
      const error = new InternalError("Test error");

      const result = extractErrorInfo(error);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe("Test error");
      expect(result.context).toBeUndefined();
    });
  });

  describe("ZodError", () => {
    it("should extract formatted validation errors from ZodError", () => {
      const schema = z.object({
        name: z.string().min(2),
        age: z.number().min(18),
      });
      let zodError: ZodError;
      try {
        schema.parse({
          name: "a",
          age: "invalid",
        });
      } catch (error) {
        zodError = error as ZodError;
      }

      const result = extractErrorInfo(zodError!);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      expect(result.message).toContain("name");
      expect(result.message).toContain("age");
      expect(result.context).toEqual({
        type: ZOD_SCHEMA_VALIDATION_ERROR,
      });
    });
  });

  describe("HttpError (AxiosError)", () => {
    it("should extract status and message from HttpError response", () => {
      const mockResponse = {
        status: StatusCodes.NOT_FOUND,
        data: {
          message: "Resource not found",
          additionalData: "test",
        },
      } as AxiosResponse;

      const error = new AxiosError(
        undefined,
        undefined,
        undefined,
        undefined,
        mockResponse
      );

      const result = extractErrorInfo(error);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.message).toBe("Resource not found");
      expect(result.context).toEqual({
        message: "Resource not found",
        additionalData: "test",
      });
    });

    it("should fallback to default status and message when response is undefined", () => {
      const error = new AxiosError("Network Error");

      const result = extractErrorInfo(error);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe(DEFAULT_ERROR_MESSAGE);
      expect(result.context).toBeUndefined();
    });

    it("should fallback to default message when response data has no message", () => {
      const mockResponse = {
        status: StatusCodes.BAD_REQUEST,
        data: {},
      } as AxiosResponse;

      const error = new AxiosError(
        undefined,
        undefined,
        undefined,
        undefined,
        mockResponse
      );

      const result = extractErrorInfo(error);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      expect(result.message).toBe(DEFAULT_ERROR_MESSAGE);
    });
  });

  describe("Error", () => {
    it("should extract message from standard Error", () => {
      const error = new Error("Test error");

      const result = extractErrorInfo(error);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe("Test error");
      expect(result.context).toBeUndefined();
    });
  });

  describe("Unknown error", () => {
    it("should return default status and message for non-Error objects", () => {
      const unknownError = "This is not an Error object";

      const result = extractErrorInfo(unknownError);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe(DEFAULT_ERROR_MESSAGE);
      expect(result.context).toBeUndefined();
    });
  });
});

describe("formatZodErrors", () => {
  it("should format single ZodError issue", () => {
    const error = new ZodError([
      {
        code: "too_small",
        minimum: 2,
        type: "string",
        inclusive: true,
        exact: false,
        message: "String must contain at least 2 character(s)",
        path: ["name"],
      },
    ]);

    const result = formatZodErrors(error);

    expect(result).toBe("name - String must contain at least 2 character(s)");
  });

  it("should format multiple ZodError issues", () => {
    const error = new ZodError([
      {
        code: "too_small",
        minimum: 2,
        type: "string",
        inclusive: true,
        exact: false,
        message: "String must contain at least 2 character(s)",
        path: ["name"],
      },
      {
        code: "invalid_type",
        expected: "number",
        received: "string",
        message: "Expected number, received string",
        path: ["age"],
      },
    ]);

    const result = formatZodErrors(error);

    expect(result).toContain(
      "name - String must contain at least 2 character(s)"
    );
    expect(result).toContain("age - Expected number, received string");
    expect(result).toContain("; ");
  });

  it("should format nested path errors", () => {
    const error = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "number",
        message: "Expected string, received number",
        path: ["user", "email"],
      },
    ]);

    const result = formatZodErrors(error);

    expect(result).toBe("user.email - Expected string, received number");
  });
});

describe("isNonRetryableError", () => {
  it.each([
    {
      name: "400 Bad Request",
      status: StatusCodes.BAD_REQUEST,
      expected: true,
    },
    {
      name: "403 Forbidden",
      status: StatusCodes.FORBIDDEN,
      expected: true,
    },
    {
      name: "404 Not Found",
      status: StatusCodes.NOT_FOUND,
      expected: true,
    },
    {
      name: "422 Unprocessable Entity",
      status: StatusCodes.UNPROCESSABLE_ENTITY,
      expected: true,
    },
    {
      name: "499 Client Closed Request",
      status: 499,
      expected: true,
    },
    {
      name: "500 Internal Server Error",
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      expected: false,
    },
    {
      name: "502 Bad Gateway",
      status: StatusCodes.BAD_GATEWAY,
      expected: false,
    },
    {
      name: "503 Service Unavailable",
      status: StatusCodes.SERVICE_UNAVAILABLE,
      expected: false,
    },
    {
      name: "200 OK",
      status: StatusCodes.OK,
      expected: false,
    },
    {
      name: "201 Created",
      status: StatusCodes.CREATED,
      expected: false,
    },
    {
      name: "301 Moved Permanently",
      status: StatusCodes.MOVED_PERMANENTLY,
      expected: false,
    },
  ])("should return $expected for $name", ({ status, expected }) => {
    expect(
      isNonRetryableError({
        status,
        message: "Test message",
      })
    ).toBe(expected);
  });
});
