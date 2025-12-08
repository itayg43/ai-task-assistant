import { Response } from "express";
import { describe, expect, it } from "vitest";

import { getValidatedQuery } from "./validated-query";

describe("getValidatedQuery", () => {
  it("should return validated query when it exists", () => {
    const mockQuery = {
      skip: 0,
      take: 10,
      orderBy: "createdAt",
    };

    const mockResponse = {
      locals: {
        validatedQuery: mockQuery,
      },
    } as unknown as Response;

    const result = getValidatedQuery(mockResponse);

    expect(result).toEqual(mockQuery);
    expect(result).toBe(mockQuery);
  });

  it("should throw error when validatedQuery is missing", () => {
    const mockResponse = {
      locals: {},
    } as unknown as Response;

    expect(() => getValidatedQuery(mockResponse)).toThrow(
      "Validated query is missing"
    );
  });

  it("should throw error when validatedQuery is undefined", () => {
    const mockResponse = {
      locals: {
        validatedQuery: undefined,
      },
    } as unknown as Response;

    expect(() => getValidatedQuery(mockResponse)).toThrow(
      "Validated query is missing"
    );
  });
});
