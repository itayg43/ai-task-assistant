import { Response } from "express";
import { describe, expect, it } from "vitest";

import { getValidatedParams } from "./validated-params";

describe("getValidatedParams", () => {
  it("should return validated params when they exist", () => {
    const mockParams = {
      id: "123",
      userId: "456",
    };

    const mockResponse = {
      locals: {
        validatedParams: mockParams,
      },
    } as unknown as Response;

    const result = getValidatedParams(mockResponse);

    expect(result).toEqual(mockParams);
    expect(result).toBe(mockParams);
  });

  it("should throw error when validatedParams is missing", () => {
    const mockResponse = {
      locals: {},
    } as unknown as Response;

    expect(() => getValidatedParams(mockResponse)).toThrow(
      "Validated params is missing"
    );
  });

  it("should throw error when validatedParams is undefined", () => {
    const mockResponse = {
      locals: {
        validatedParams: undefined,
      },
    } as unknown as Response;

    expect(() => getValidatedParams(mockResponse)).toThrow(
      "Validated params is missing"
    );
  });
});
