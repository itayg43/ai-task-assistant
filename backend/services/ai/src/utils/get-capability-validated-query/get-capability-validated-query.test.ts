import { Response } from "express";
import { beforeEach, describe, expect, it } from "vitest";

import { mockCallbackUrl } from "@mocks/callbackUrl-mocks";
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
          callbackUrl: mockCallbackUrl,
        },
      },
    };
  });

  it("should return the capability validated query with callbackUrl", () => {
    const result = getCapabilityValidatedQuery(mockResponse as Response);

    expect(result.callbackUrl).toBe(mockCallbackUrl);
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
