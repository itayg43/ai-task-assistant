import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskHandler } from "@capabilities/parse-task/handler";
import {
  mockParseTaskInputConfig,
  mockParseTaskOutput,
} from "@capabilities/parse-task/parse-task-mocks";
import { createParseTaskCorePrompt } from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { Mocked } from "@shared/types";

vi.mock("@clients/openai", () => ({
  executeParse: vi.fn(),
}));
vi.mock("@capabilities/parse-task/prompts");

describe("parseTaskHandler", () => {
  let mockedCreateCorePrompt: Mocked<typeof createParseTaskCorePrompt>;
  let mockedExecuteParse: Mocked<typeof executeParse>;

  const mockNaturalLanguage = "Submit Q2 report by next Friday";
  const mockPrompt: ResponseCreateParamsNonStreaming = {
    model: "gpt-4.1-mini",
    instructions: "instructions",
    input: "input",
    temperature: 0,
  };
  const mockExecuteParseResponse = {
    output: mockParseTaskOutput,
    usage: {
      tokens: {
        input: 150,
        output: 135,
      },
    },
    durationMs: 250,
  };

  const executeHandler = async () => {
    return await parseTaskHandler({
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
    });
  };

  beforeEach(() => {
    mockedCreateCorePrompt = vi.mocked(createParseTaskCorePrompt);
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
      mockParseTaskInputConfig
    );
    expect(mockedExecuteParse).toHaveBeenCalledWith(
      CAPABILITY.PARSE_TASK,
      mockNaturalLanguage,
      mockPrompt
    );
    expect(metadata.tokens.input).toBe(150);
    expect(metadata.tokens.output).toBe(135);
    expect(metadata.durationMs).toBe(250);
    expect(result).toEqual(mockParseTaskOutput);
  });

  it("should handle error", async () => {
    const apiError = new Error("ExecuteParse Error");
    mockedExecuteParse.mockRejectedValue(apiError);

    await expect(executeHandler()).rejects.toThrow(apiError);
  });
});
