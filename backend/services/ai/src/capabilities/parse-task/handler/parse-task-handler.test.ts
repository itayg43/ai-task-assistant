import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskHandler } from "@capabilities/parse-task/handler";
import {
  mockNaturalLanguage,
  mockParseTaskInputConfig,
  mockParseTaskOutput,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { createParseTaskCorePrompt } from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import {
  mockOpenaiDurationMs,
  mockOpenaiResponseId,
  mockOpenaiTokenUsage,
  mockPrompt,
} from "@mocks/openai-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { Mocked } from "@shared/types";

vi.mock("@clients/openai", () => ({
  executeParse: vi.fn(),
}));

vi.mock("@capabilities/parse-task/prompts");

describe("parseTaskHandler", () => {
  let mockedCreateCorePrompt: Mocked<typeof createParseTaskCorePrompt>;
  let mockedExecuteParse: Mocked<typeof executeParse>;

  const mockExecuteParseResponse = {
    openaiResponseId: mockOpenaiResponseId,
    output: mockParseTaskOutput,
    usage: {
      tokens: mockOpenaiTokenUsage,
    },
    durationMs: mockOpenaiDurationMs,
  };

  const executeHandler = async () => {
    return await parseTaskHandler(
      {
        ...mockParseTaskValidatedInput,
        body: {
          ...mockParseTaskValidatedInput.body,
          naturalLanguage: mockNaturalLanguage,
        },
      },
      mockAiServiceRequestId
    );
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
    const response = await executeHandler();

    expect(mockedCreateCorePrompt).toHaveBeenCalledWith(
      "v1",
      mockNaturalLanguage,
      mockParseTaskInputConfig
    );
    expect(mockedExecuteParse).toHaveBeenCalledWith(
      mockParseTaskValidatedInput.params.capability,
      mockNaturalLanguage,
      mockPrompt,
      mockAiServiceRequestId
    );
    expect(response.openaiMetadata.responseId).toBe(mockOpenaiResponseId);
    expect(response.openaiMetadata.tokens.input).toBe(
      mockOpenaiTokenUsage.input
    );
    expect(response.openaiMetadata.tokens.output).toBe(
      mockOpenaiTokenUsage.output
    );
    expect(response.openaiMetadata.durationMs).toBe(mockOpenaiDurationMs);
    expect(response.result).toEqual(mockParseTaskOutput);
  });

  it("should handle error", async () => {
    const apiError = new Error("ExecuteParse Error");
    mockedExecuteParse.mockRejectedValue(apiError);

    await expect(executeHandler()).rejects.toThrow(apiError);
  });
});
