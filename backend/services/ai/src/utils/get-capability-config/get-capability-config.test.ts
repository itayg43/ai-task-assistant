import { Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import { getCapabilityConfig } from "@utils/get-capability-config";

describe("getCapabilityConfig", () => {
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    const mockInputSchema = z.object({}) as z.ZodSchema<any>;
    vi.spyOn(mockInputSchema, "parse").mockImplementation(vi.fn());
    const mockOutputSchema = z.object({}) as z.ZodSchema<any>;
    vi.spyOn(mockOutputSchema, "parse").mockImplementation(vi.fn());

    mockResponse = {
      locals: {
        capabilityConfig: {
          name: "parse-task",
          handler: vi.fn(),
          inputSchema: mockInputSchema,
          outputSchema: mockOutputSchema,
        },
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return the saved capability config", () => {
    const config = getCapabilityConfig(mockResponse as Response);

    expect(config.name).toBeDefined();
    expect(config.handler).toBeDefined();
    expect(config.inputSchema).toBeDefined();
    expect(config.outputSchema).toBeDefined();
  });

  it("should throw an error when the capability config not defined", () => {
    mockResponse = {
      locals: {
        capabilityConfig: undefined,
      },
    };

    expect(() => getCapabilityConfig(mockResponse as Response)).toThrow();
  });
});
