import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskHandler } from "@capabilities/parse-task/handler";
import {
  mockParseTaskCapabilityResponse,
  mockParseTaskInputConfig,
} from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { Mocked } from "@shared/types";
import { app } from "../../app";

vi.mock("@capabilities/parse-task/handler", () => ({
  parseTaskHandler: vi.fn(),
}));

// Mock CORS middleware using __mocks__ directory with explicit import path
// Simple vi.mock() doesn't resolve the @middlewares/cors alias correctly
vi.mock("@middlewares/cors", () => {
  return import("../../middlewares/cors/__mocks__/cors");
});

describe("capabilitiesController (integration)", () => {
  const executeRequest = async (
    url: string,
    body: string | object | undefined,
    query: Record<string, string>
  ) => {
    const req = request(app).post(url).query(query);

    return await req.send(body);
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("parseTask", () => {
    let mockedParseTaskHandler: Mocked<typeof parseTaskHandler>;

    const parseTaskCapabilityUrl = "/api/v1/ai/capabilities/parse-task";

    const mockNaturalLanguage = "Submit Q2 report by next Friday";

    beforeEach(() => {
      mockedParseTaskHandler = vi.mocked(parseTaskHandler);
    });

    it(`should return ${StatusCodes.OK} with parsed task for valid input`, async () => {
      mockedParseTaskHandler.mockResolvedValue(mockParseTaskCapabilityResponse);

      const response = await executeRequest(
        parseTaskCapabilityUrl,
        {
          naturalLanguage: mockNaturalLanguage,
          config: mockParseTaskInputConfig,
        },
        {
          pattern: CAPABILITY_PATTERN.SYNC,
        }
      );

      expect(mockedParseTaskHandler).toHaveBeenCalledWith(
        {
          body: {
            naturalLanguage: mockNaturalLanguage,
            config: mockParseTaskInputConfig,
          },
          params: {
            capability: CAPABILITY.PARSE_TASK,
          },
          query: {
            pattern: CAPABILITY_PATTERN.SYNC,
          },
        },
        response.body.aiServiceRequestId
      );

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.openaiMetadata).toEqual(
        mockParseTaskCapabilityResponse.openaiMetadata
      );
      expect(response.body.result).toEqual(
        mockParseTaskCapabilityResponse.result
      );
      expect(response.body.aiServiceRequestId).toEqual(expect.any(String));
    });

    it(`should return ${StatusCodes.BAD_REQUEST} for invalid capability`, async () => {
      const response = await executeRequest(
        "/api/v1/ai/capabilities/invalid-capability",
        {
          naturalLanguage: mockNaturalLanguage,
          config: mockParseTaskInputConfig,
        },
        {
          pattern: CAPABILITY_PATTERN.SYNC,
        }
      );

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });

    it(`should return ${StatusCodes.BAD_REQUEST} for invalid pattern`, async () => {
      const response = await executeRequest(
        parseTaskCapabilityUrl,
        {
          naturalLanguage: "Submit Q2 report by next Friday",
          config: mockParseTaskInputConfig,
        },
        { pattern: "invalid-pattern" }
      );

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });

    it(`should return ${StatusCodes.BAD_REQUEST} for invalid input`, async () => {
      const response = await executeRequest(
        parseTaskCapabilityUrl,
        {
          naturalLanguage: "",
          config: mockParseTaskInputConfig,
        },
        {
          pattern: CAPABILITY_PATTERN.SYNC,
        }
      );

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });

    it(`should handle unexpected error and return ${StatusCodes.INTERNAL_SERVER_ERROR}`, async () => {
      mockedParseTaskHandler.mockRejectedValue(new Error("Unexpected error"));

      const response = await executeRequest(
        parseTaskCapabilityUrl,
        {
          naturalLanguage: mockNaturalLanguage,
          config: mockParseTaskInputConfig,
        },
        {
          pattern: CAPABILITY_PATTERN.SYNC,
        }
      );

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.body.message).toBeDefined();
    });
  });
});
