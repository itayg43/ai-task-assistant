import { Response } from "express";
import { beforeEach, describe, expect, it } from "vitest";

import { CAPABILITY_PATTERN } from "@constants";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { BadRequestError } from "@shared/errors";
import { getCapabilityValidatedQuery } from "./get-capability-validated-query";

describe("getCapabilityValidatedQuery", () => {
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
        capabilityValidatedQuery: {
          pattern: CAPABILITY_PATTERN.SYNC,
        },
      },
    };
  });

  it("should return the capability validated query for SYNC pattern", () => {
    const result = getCapabilityValidatedQuery(mockResponse as Response);

    expect(result.pattern).toBe(CAPABILITY_PATTERN.SYNC);
  });

  it("should return the capability validated query for ASYNC pattern", () => {
    const mockCallbackUrl = "https://example.com/callback";

    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
        capabilityValidatedQuery: {
          pattern: CAPABILITY_PATTERN.ASYNC,
          callbackUrl: mockCallbackUrl,
        },
      },
    };

    const result = getCapabilityValidatedQuery(mockResponse as Response);

    expect(result.pattern).toBe(CAPABILITY_PATTERN.ASYNC);
    if (result.pattern === CAPABILITY_PATTERN.ASYNC) {
      expect(result.callbackUrl).toBe(mockCallbackUrl);
    }
  });

  it("should throw BadRequestError when the capability validated query is not defined", () => {
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
      },
    };

    expect(() => getCapabilityValidatedQuery(mockResponse as Response)).toThrow(
      expect.any(BadRequestError)
    );
  });
});
