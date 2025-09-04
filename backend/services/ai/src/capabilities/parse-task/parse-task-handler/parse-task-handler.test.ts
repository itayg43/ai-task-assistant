import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskHandler } from "@capabilities/parse-task/parse-task-handler";
import { parseTaskPrompt } from "@capabilities/parse-task/parse-task-prompts";
import { openai } from "@clients/openai";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { Mocked } from "@shared/types";
import { predefinedTokenCounters } from "@shared/utils/count-tokens";
import { withDurationAsync } from "@shared/utils/with-duration";

vi.mock("@clients/openai");
vi.mock("@capabilities/parse-task/parse-task-prompt");

vi.mock("@shared/utils/with-duration", () => ({
  withDurationAsync: vi.fn(),
}));

vi.mock("@shared/utils/count-tokens", () => ({
  predefinedTokenCounters: {
    "gpt-4o-mini": vi.fn(),
  },
}));

describe("parseTaskHandler", () => {
  let mockedParseTaskPrompt: Mocked<typeof parseTaskPrompt>;
  let mockedOpenaiCreate: Mocked<typeof openai.responses.create>;
  let mockedWithDurationAsync: Mocked<typeof withDurationAsync>;
  let mockedPredefinedTokenCounter: Mocked<
    (typeof predefinedTokenCounters)["gpt-4o-mini"]
  >;

  const mockNaturalLanguage = "Submit Q2 report by next Friday";
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
    recurrence: null,
    subtasks: ["Gather Q2 data", "Create report draft", "Review with team"],
  };
  const mockWithDurationAsyncDuration = 150;
  const mockPredefinedTokenCounterCount = 9;

  const executeHandler = async () => {
    return await parseTaskHandler({
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
  };

  beforeEach(() => {
    mockedParseTaskPrompt = vi.mocked(parseTaskPrompt);
    mockedParseTaskPrompt.mockReturnValue(mockPrompt);

    mockedOpenaiCreate = vi.mocked(openai.responses.create);
    mockedOpenaiCreate.mockResolvedValue({
      output_text: JSON.stringify(mockParsedTask),
      usage: {
        output_tokens: 135,
      },
    } as any);

    mockedWithDurationAsync = vi.mocked(withDurationAsync);
    mockedWithDurationAsync.mockImplementation(async (fn) => {
      const result = await fn();

      return {
        result,
        duration: mockWithDurationAsyncDuration,
      };
    });

    mockedPredefinedTokenCounter = vi.mocked(
      predefinedTokenCounters["gpt-4o-mini"]
    );
    mockedPredefinedTokenCounter.mockReturnValue({
      count: mockPredefinedTokenCounterCount,
      duration: 350,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should parse task successfully", async () => {
    const { metadata, result } = await executeHandler();

    expect(mockedParseTaskPrompt).toHaveBeenCalledWith(mockNaturalLanguage);
    expect(mockedOpenaiCreate).toHaveBeenCalledWith(mockPrompt);
    expect(mockedPredefinedTokenCounter).toHaveBeenCalledWith(
      mockNaturalLanguage
    );
    expect(metadata.tokens.input).toBe(mockPredefinedTokenCounterCount);
    expect(metadata.tokens.output).toBe(135);
    expect(metadata.duration).toBe(`${mockWithDurationAsyncDuration}ms`);
    expect(result).toEqual(mockParsedTask);
  });

  it("should handle openai api error", async () => {
    const apiError = new Error("API Error");
    mockedOpenaiCreate.mockRejectedValue(apiError);

    await expect(executeHandler()).rejects.toThrow(apiError);
  });

  it("should handle invalid json error", async () => {
    const mockAiResponse = {
      output_text: "This is not valid JSON",
      usage: {
        output_tokens: 10,
      },
    };

    mockedOpenaiCreate.mockResolvedValue(mockAiResponse as any);

    await expect(executeHandler()).rejects.toThrow();
  });

  it("should handle invalid schema error", async () => {
    const mockAiResponse = {
      output_text: JSON.stringify({
        title: "Test task",
        // Missing required fields like priorityLevel, category, etc.
      }),
      usage: {
        output_tokens: 15,
      },
    };

    mockedOpenaiCreate.mockResolvedValue(mockAiResponse as any);

    await expect(executeHandler()).rejects.toThrow();
  });

  it("should handle token counting error", async () => {
    const mockCountingError = new Error("Token counting failed");

    mockedPredefinedTokenCounter.mockImplementation(() => {
      throw mockCountingError;
    });

    await expect(executeHandler()).rejects.toThrow(mockCountingError);
  });
});
