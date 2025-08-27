import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CATEGORY,
  PRIORITY_LEVEL,
} from "@capabilities/parse-task/parse-task-constants";
import { parseTaskHandler } from "@capabilities/parse-task/parse-task-handler";
import { CAPABILITY, CAPABILITY_PATTERN } from "@shared/constants";
import { Mocked } from "@shared/types";
import { app } from "../../app";

vi.mock("@capabilities/parse-task/parse-task-handler");

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
    let mockedParseTaskHandler: Mocked<typeof parseTaskHandler>;

    const parseTaskCapabilityUrl = "/api/v1/ai/capabilities/parse-task";

    const mockNaturalLanguage = "Submit Q2 report by next Friday";

    beforeEach(() => {
      mockedParseTaskHandler = vi.mocked(parseTaskHandler);
    });

    it(`should return ${StatusCodes.OK} with parsed task for valid input`, async () => {
      const mockMetadata = {
        tokens: {
          input: 9,
          output: 135,
        },
        duration: "4165ms",
      };
      const mockParsedTask = {
        title: "Submit Q2 report",
        dueDate: "2024-01-19T23:59:59Z",
        priorityLevel: PRIORITY_LEVEL[0],
        priorityScore: 88,
        priorityReason:
          "Marked as high priority with a clear deadline next Friday.",
        category: CATEGORY[1],
        recurrence: null,
        subtasks: ["Gather Q2 data", "Create report draft", "Review with team"],
      };
      const mockHandlerResponse = {
        metadata: mockMetadata,
        result: mockParsedTask,
      };

      mockedParseTaskHandler.mockResolvedValue(mockHandlerResponse);

      const response = await executeRequest(
        parseTaskCapabilityUrl,
        {
          naturalLanguage: mockNaturalLanguage,
        },
        {
          pattern: CAPABILITY_PATTERN.SYNC,
        }
      );

      expect(mockedParseTaskHandler).toHaveBeenCalledWith({
        body: {
          naturalLanguage: mockNaturalLanguage,
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
