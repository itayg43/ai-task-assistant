import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handler } from "@capabilities/parse-task/handler";
import { createCorePrompt } from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { Mocked } from "@shared/types";

vi.mock("@clients/openai", () => ({
  executeParse: vi.fn(),
}));
vi.mock("@capabilities/parse-task/prompts");

describe("parseTaskHandler", () => {
  let mockedCreateCorePrompt: Mocked<typeof createCorePrompt>;
  let mockedExecuteParse: Mocked<typeof executeParse>;

  const mockNaturalLanguage = "Submit Q2 report by next Friday";
  const mockConfig = {
    categories: ["personal", "work", "health"],
    priorities: {
      levels: ["low", "medium", "high"],
      scores: {
        low: { min: 0, max: 33 },
        medium: { min: 34, max: 66 },
        high: { min: 67, max: 100 },
      },
      overallScoreRange: { min: 0, max: 100 },
    },
    frequencies: ["daily", "weekly", "monthly"],
  };
  const mockPrompt = {
    model: "gpt-4o-mini",
    instructions: "instructions",
    input: "input",
    temperature: 0,
  };
  const mockParsedTask = {
    title: "Submit Q2 report",
    dueDate: "2024-01-19T23:59:59Z",
    priorityLevel: "high",
    priorityScore: 88,
    priorityReason:
      "Marked as high priority with a clear deadline next Friday.",
    category: "work",
  };
  const mockExecuteParseResponse = {
    output: mockParsedTask,
    usage: {
      tokens: {
        input: 150,
        output: 135,
      },
    },
    durationMs: 250,
  };

  const executeHandler = async () => {
    return await handler({
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
  };

  beforeEach(() => {
    mockedCreateCorePrompt = vi.mocked(createCorePrompt);
    mockedCreateCorePrompt.mockReturnValue(mockPrompt);

    mockedExecuteParse = vi.mocked(executeParse);
    mockedExecuteParse.mockResolvedValue(mockExecuteParseResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle success", async () => {
    const { metadata, result } = await executeHandler();

    expect(mockedCreateCorePrompt).toHaveBeenCalledWith(
      "v1",
      mockNaturalLanguage,
      mockConfig
    );
    expect(mockedExecuteParse).toHaveBeenCalledWith(
      CAPABILITY.PARSE_TASK,
      mockNaturalLanguage,
      mockPrompt
    );
    expect(metadata.tokens.input).toBe(150);
    expect(metadata.tokens.output).toBe(135);
    expect(metadata.durationMs).toBe(250);
    expect(result).toEqual(mockParsedTask);
  });

  it("should handle error", async () => {
    const apiError = new Error("ExecuteParse Error");
    mockedExecuteParse.mockRejectedValue(apiError);

    await expect(executeHandler()).rejects.toThrow(apiError);
  });
});
