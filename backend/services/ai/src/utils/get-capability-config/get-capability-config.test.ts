import { Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskCapabilityConfig } from "@capabilities/parse-task/parse-task-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { getCapabilityConfig } from "@utils/get-capability-config";

describe("getCapabilityConfig", () => {
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
        capabilityConfig: mockParseTaskCapabilityConfig,
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
        requestId: mockAiServiceRequestId,
        capabilityConfig: undefined,
      },
    };

    expect(() => getCapabilityConfig(mockResponse as Response)).toThrow();
  });
});
