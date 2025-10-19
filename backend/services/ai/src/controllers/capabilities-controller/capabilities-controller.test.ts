import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handler } from "@capabilities/parse-task/handler";
import { ParseTaskInputConfig } from "@capabilities/parse-task/parse-task-types";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { Mocked } from "@shared/types";
import { app } from "../../app";

vi.mock("@capabilities/parse-task/handler", () => ({
  handler: vi.fn(),
}));

// Mock CORS middleware using __mocks__ directory with explicit import path
// Simple vi.mock() doesn't resolve the @middlewares/cors alias correctly
vi.mock("@middlewares/cors", () => {
  return import("../../middlewares/cors/__mocks__/cors");
});

describe("capabilitiesController", () => {
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
    let mockedHandler: Mocked<typeof handler>;

    const parseTaskCapabilityUrl = "/api/v1/ai/capabilities/parse-task";

    const mockNaturalLanguage = "Submit Q2 report by next Friday";
    const mockConfig: ParseTaskInputConfig = {
      categories: ["personal", "work", "health"],
      priorities: {
        levels: ["low", "medium", "high"],
        scores: {
          low: { min: 0, max: 33 },
          medium: { min: 34, max: 66 },
          high: { min: 67, max: 100 },
        },
        overallScoreRange: {
          min: 0,
          max: 100,
        },
      },
      frequencies: ["daily", "weekly", "monthly"],
    };

    beforeEach(() => {
      mockedHandler = vi.mocked(handler);
    });

    it(`should return ${StatusCodes.CREATED} with parsed task for valid input`, async () => {
      const mockMetadata = {
        tokens: {
          input: 150,
          output: 135,
        },
        durationMs: 250,
      };
      const mockParsedTask = {
        title: "Submit Q2 report",
        dueDate: "2024-01-19T23:59:59Z",
        category: mockConfig.categories[0],
        priority: {
          level: mockConfig.priorities.levels[0],
          score: 88,
          reason: "Marked as high priority with a clear deadline next Friday.",
        },
      };
      const mockHandlerResponse = {
        metadata: mockMetadata,
        result: mockParsedTask,
      };

      mockedHandler.mockResolvedValue(mockHandlerResponse);

      const response = await executeRequest(
        parseTaskCapabilityUrl,
        {
          naturalLanguage: mockNaturalLanguage,
          config: mockConfig,
        },
        {
          pattern: CAPABILITY_PATTERN.SYNC,
        }
      );

      expect(mockedHandler).toHaveBeenCalledWith({
        body: {
          naturalLanguage: mockNaturalLanguage,
          config: mockConfig,
        },
        params: {
          capability: CAPABILITY.PARSE_TASK,
        },
        query: {
          pattern: CAPABILITY_PATTERN.SYNC,
        },
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.metadata).toEqual(mockHandlerResponse.metadata);
      expect(response.body.result).toEqual(mockHandlerResponse.result);
    });

    it(`should return ${StatusCodes.BAD_REQUEST} for invalid capability`, async () => {
      const response = await executeRequest(
        "/api/v1/ai/capabilities/invalid-capability",
        {
          naturalLanguage: mockNaturalLanguage,
          config: mockConfig,
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
          config: mockConfig,
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
          config: mockConfig,
        },
        {
          pattern: CAPABILITY_PATTERN.SYNC,
        }
      );

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });

    it(`should handle unexpected error and return ${StatusCodes.INTERNAL_SERVER_ERROR}`, async () => {
      mockedHandler.mockRejectedValue(new Error("Unexpected error"));

      const response = await executeRequest(
        parseTaskCapabilityUrl,
        {
          naturalLanguage: mockNaturalLanguage,
          config: mockConfig,
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
