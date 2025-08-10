import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskHandler } from "@capabilities/parse-task/parse-task-handler";
import { parseTaskPrompt } from "@capabilities/parse-task/parse-task-prompt";
import { openai } from "@clients/openai";
import { Mocked } from "@shared/types";

vi.mock("@clients/openai");
vi.mock("@capabilities/parse-task/parse-task-prompt");

describe("parseTaskHandler", () => {
  let mockedParseTaskPrompt: Mocked<typeof parseTaskPrompt>;
  let mockedOpenaiCreate: Mocked<typeof openai.responses.create>;

  beforeEach(() => {
    mockedParseTaskPrompt = vi.mocked(parseTaskPrompt);
    mockedOpenaiCreate = vi.mocked(openai.responses.create);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should parse valid ai response successfully", async () => {
    const mockNaturalLanguage = "Submit Q2 report by next Friday";
    const mockParseTaskPrompt = {
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
    const mockAiResponse = {
      output_text: JSON.stringify(mockParsedTask),
    };

    mockedParseTaskPrompt.mockReturnValue(mockParseTaskPrompt);
    mockedOpenaiCreate.mockResolvedValue(mockAiResponse as any);

    const result = await parseTaskHandler(mockNaturalLanguage);

    expect(mockedParseTaskPrompt).toHaveBeenCalledWith(mockNaturalLanguage);
    expect(mockedOpenaiCreate).toHaveBeenCalledWith(mockParseTaskPrompt);
    expect(result).toEqual(mockParsedTask);
  });

  it("should handle openai api errors", async () => {
    mockedOpenaiCreate.mockRejectedValue(new Error("API Error"));

    await expect(parseTaskHandler("test task")).rejects.toThrow();
  });

  it("should handle ai returning valid json but invalid schema", async () => {
    mockedOpenaiCreate.mockResolvedValue({
      output_text: JSON.stringify({
        title: "Test task",
        // Missing required fields like priorityLevel, category, etc.
      }),
    } as any);

    await expect(parseTaskHandler("test task")).rejects.toThrow();
  });

  it("should handle ai returning invalid json", async () => {
    mockedOpenaiCreate.mockResolvedValue({
      output_text: "This is not valid JSON",
    } as any);

    await expect(parseTaskHandler("test task")).rejects.toThrow();
  });
});
