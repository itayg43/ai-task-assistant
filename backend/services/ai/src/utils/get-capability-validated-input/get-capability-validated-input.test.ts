import { Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskValidatedInput } from "@capabilities/parse-task/parse-task-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";

describe("getCapabilityValidatedInput", () => {
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
        capabilityValidatedInput: mockParseTaskValidatedInput,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return the saved capability validated input", () => {
    const validatedInput = getCapabilityValidatedInput(
      mockResponse as Response
    );

    expect(validatedInput.params).toBeDefined();
    expect(validatedInput.query).toBeDefined();
    expect(validatedInput.body.naturalLanguage).toBeDefined();
    expect(validatedInput.body.config).toBeDefined();
  });

  it("should throw an error when the capability validated input not defined", () => {
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
        capabilityValidatedInput: undefined,
      },
    };

    expect(() => getCapabilityValidatedInput(mockResponse as Response)).toThrow(
      expect.any(Error)
    );
  });
});
