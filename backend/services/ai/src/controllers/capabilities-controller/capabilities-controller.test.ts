import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskHandler } from "@capabilities/parse-task/parse-task-handler";
import { Mocked } from "@shared/types";
import { app } from "../../app";

// Mock CORS middleware using __mocks__ directory with explicit import path
// Simple vi.mock() doesn't resolve the @middlewares/cors alias correctly
vi.mock("@middlewares/cors", () => {
  return import("../../middlewares/cors/__mocks__/cors");
});
vi.mock("@capabilities/parse-task/parse-task-handler");

describe("capabilitiesController", () => {
  const executeRequest = async (
    url: string,
    body: string | object | undefined
  ) => {
    return await request(app).post(url).send(body);
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("parseTask", () => {
    let mockedParseTaskHandler: Mocked<typeof parseTaskHandler>;

    const parseTaskCapabilityUrl = "/api/v1/ai/capabilities/parse-task";

    beforeEach(() => {
      mockedParseTaskHandler = vi.mocked(parseTaskHandler);
    });

    it("should return 200 with parsed task for valid input", async () => {
      const mockNaturalLanguage = "Submit Q2 report by next Friday";
      const mockParsedTask = {
        title: "Submit Q2 report",
        dueDate: "2024-01-19T23:59:59Z",
        priorityLevel: "high",
        priorityScore: 88,
        priorityReason:
          "Marked as high priority with a clear deadline next Friday.",
        category: "work",
        recurrence: null,
        subtasks: ["Gather Q2 data", "Create report draft", "Review with team"],
      };

      mockedParseTaskHandler.mockResolvedValue(mockParsedTask as any);

      const response = await executeRequest(parseTaskCapabilityUrl, {
        naturalLanguage: mockNaturalLanguage,
      });

      expect(mockedParseTaskHandler).toHaveBeenCalledWith({
        body: {
          naturalLanguage: mockNaturalLanguage,
        },
        query: {},
        params: {},
      });
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toEqual(mockParsedTask);
    });

    it("should return 400 for invalid input", async () => {
      const response = await executeRequest(parseTaskCapabilityUrl, {
        naturalLanguage: "",
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toContain("Required");
    });

    it("should handle unexpected error and return 500", async () => {
      const mockNaturalLanguage = "Submit Q2 report by next Friday";

      mockedParseTaskHandler.mockRejectedValue(new Error("Unexpected error"));

      const response = await executeRequest(parseTaskCapabilityUrl, {
        naturalLanguage: mockNaturalLanguage,
      });

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.body.message).toContain("Unexpected");
    });
  });
});
