import { Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CAPABILITY_PATTERN } from "@constants";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { BadRequestError } from "@shared/errors";
import { getCapabilityPattern } from "./get-capability-pattern";

describe("getCapabilityPattern", () => {
  let mockResponse: Partial<Response>;

  const createMockResponse = (
    capabilityPattern?: (typeof CAPABILITY_PATTERN)[keyof typeof CAPABILITY_PATTERN]
  ) => ({
    locals: {
      requestId: mockAiServiceRequestId,
      capabilityPattern,
    },
  });

  beforeEach(() => {
    mockResponse = createMockResponse(CAPABILITY_PATTERN.SYNC);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [CAPABILITY_PATTERN.SYNC, "SYNC"],
    [CAPABILITY_PATTERN.ASYNC, "ASYNC"],
  ])("should return the saved capability pattern: %s", (pattern, _label) => {
    mockResponse = createMockResponse(pattern);

    const result = getCapabilityPattern(mockResponse as Response);

    expect(result).toBe(pattern);
  });

  it("should throw BadRequestError when the capability pattern is not defined", () => {
    mockResponse = createMockResponse(undefined);

    expect(() => getCapabilityPattern(mockResponse as Response)).toThrow(
      new BadRequestError("Capability pattern not defined")
    );
  });
});
