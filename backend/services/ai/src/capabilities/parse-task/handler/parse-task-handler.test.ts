import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskHandler } from "@capabilities/parse-task/handler";
import {
  mockNaturalLanguage,
  mockParseTaskErrorOutputCoreV2,
  mockParseTaskInputConfig,
  mockParseTaskOutput,
  mockParseTaskSuccessOutputCoreV2,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { createParseTaskCorePrompt } from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import { env } from "@config/env";
import {
  mockOpenaiDurationMs,
  mockOpenaiResponseId,
  mockOpenaiTokenUsage,
  mockPrompt,
  mockPromptVersion,
} from "@mocks/openai-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { BadRequestError } from "@shared/errors";
import { Mocked } from "@shared/types";

vi.mock("@config/env", () => ({
  env: {
    PARSE_TASK_CORE_PROMPT_VERSION: "v1",
  },
}));

vi.mock("@clients/openai", () => ({
  executeParse: vi.fn(),
}));

vi.mock("@capabilities/parse-task/prompts");

describe("parseTaskHandler", () => {
  let envCorePromptVersionSpy: ReturnType<typeof vi.spyOn>;

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
    // Use spy instead of direct assignment because envalid makes env properties readonly.
    // Spy allows us to override the getter while maintaining type safety.
    envCorePromptVersionSpy = vi.spyOn(
      env,
      "PARSE_TASK_CORE_PROMPT_VERSION",
      "get"
    );
    envCorePromptVersionSpy.mockReturnValue("v1");

    mockedCreateCorePrompt = vi.mocked(createParseTaskCorePrompt);
    mockedCreateCorePrompt.mockReturnValue(mockPrompt);

    mockedExecuteParse = vi.mocked(executeParse);
    mockedExecuteParse.mockResolvedValue(mockExecuteParseResponse);
  });

  afterEach(() => {
    envCorePromptVersionSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("should call create core prompt and execute parse", async () => {
    await executeHandler();

    expect(mockedCreateCorePrompt).toHaveBeenCalledWith(
      mockPromptVersion,
      mockNaturalLanguage,
      mockParseTaskInputConfig
    );
    expect(mockedExecuteParse).toHaveBeenCalledWith(
      mockParseTaskValidatedInput.params.capability,
      mockNaturalLanguage,
      mockPrompt,
      mockPromptVersion,
      mockAiServiceRequestId
    );
  });

  it("should handle error", async () => {
    const apiError = new Error("ExecuteParse Error");
    mockedExecuteParse.mockRejectedValue(apiError);

    await expect(executeHandler()).rejects.toThrow(apiError);
  });

  describe("v1 core behavior", () => {
    it("should handle success", async () => {
      const response = await executeHandler();

      expect(response.openaiMetadata.responseId).toBe(mockOpenaiResponseId);
      expect(response.openaiMetadata.tokens).toEqual(mockOpenaiTokenUsage);
      expect(response.openaiMetadata.durationMs).toBe(mockOpenaiDurationMs);
      expect(response.result).toEqual(mockParseTaskOutput);
    });
  });

  describe("v2 core behavior", () => {
    beforeEach(() => {
      envCorePromptVersionSpy.mockReturnValue("v2");
    });

    it("should throw BadRequestError for vague input", async () => {
      mockedExecuteParse.mockResolvedValue({
        ...mockExecuteParseResponse,
        output: mockParseTaskErrorOutputCoreV2,
      });

      try {
        await executeHandler();
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError);

        const { message, context } = error as BadRequestError;

        expect(message).toBe(mockParseTaskErrorOutputCoreV2.error?.reason);
        expect(context?.suggestions).toEqual(
          mockParseTaskErrorOutputCoreV2.error?.suggestions
        );
        expect(context?.aiServiceRequestId).toBe(mockAiServiceRequestId);
        expect(context?.openaiResponseId).toBe(mockOpenaiResponseId);
      }
    });

    it("should handle success", async () => {
      mockedExecuteParse.mockResolvedValue({
        ...mockExecuteParseResponse,
        output: mockParseTaskSuccessOutputCoreV2,
      });

      const response = await executeHandler();

      expect(response.openaiMetadata.responseId).toBe(mockOpenaiResponseId);
      expect(response.openaiMetadata.tokens).toEqual(mockOpenaiTokenUsage);
      expect(response.openaiMetadata.durationMs).toBe(mockOpenaiDurationMs);
      expect(response.result).toEqual(mockParseTaskOutput);
    });
  });
});
