import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskHandler } from "@capabilities/parse-task/handler";
import {
  PARSE_TASK_CAPABILITY,
  PARSE_TASK_CORE_OPERATION,
  PARSE_TASK_SUBTASKS_OPERATION,
} from "@capabilities/parse-task/parse-task-constants";
import {
  mockNaturalLanguage,
  mockParseTaskErrorOutputCoreV2,
  mockParseTaskInputConfig,
  mockParseTaskOutput,
  mockParseTaskOutputCore,
  mockParseTaskOutputSubtasks,
  mockParseTaskSuccessOutputCoreV2,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import {
  createParseTaskCorePrompt,
  createParseTaskSubtasksPrompt,
} from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import { env } from "@config/env";
import { AI_ERROR_TYPE } from "@constants";
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
    PARSE_TASK_SUBTASKS_PROMPT_VERSION: "v1",
  },
}));

vi.mock("@clients/openai", () => ({
  executeParse: vi.fn(),
}));

vi.mock("@capabilities/parse-task/prompts");

describe("parseTaskHandler", () => {
  let envCorePromptVersionSpy: ReturnType<typeof vi.spyOn>;
  let envSubtasksPromptVersionSpy: ReturnType<typeof vi.spyOn>;

  let mockedCreateCorePrompt: Mocked<typeof createParseTaskCorePrompt>;
  let mockedCreateSubtasksPrompt: Mocked<typeof createParseTaskSubtasksPrompt>;
  let mockedExecuteParse: Mocked<typeof executeParse>;

  const mockExecuteParseCoreResponse = {
    openaiResponseId: mockOpenaiResponseId,
    output: mockParseTaskOutputCore,
    usage: {
      tokens: mockOpenaiTokenUsage,
    },
    durationMs: mockOpenaiDurationMs,
  };

  const mockExecuteParseSubtasksResponse = {
    openaiResponseId: mockOpenaiResponseId,
    output: mockParseTaskOutputSubtasks,
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

    envSubtasksPromptVersionSpy = vi.spyOn(
      env,
      "PARSE_TASK_SUBTASKS_PROMPT_VERSION",
      "get"
    );
    envSubtasksPromptVersionSpy.mockReturnValue("v1");

    mockedCreateCorePrompt = vi.mocked(createParseTaskCorePrompt);
    mockedCreateCorePrompt.mockReturnValue(mockPrompt);

    mockedCreateSubtasksPrompt = vi.mocked(createParseTaskSubtasksPrompt);
    mockedCreateSubtasksPrompt.mockReturnValue(mockPrompt);

    mockedExecuteParse = vi.mocked(executeParse);
    mockedExecuteParse
      .mockResolvedValueOnce(mockExecuteParseCoreResponse)
      .mockResolvedValueOnce(mockExecuteParseSubtasksResponse);
  });

  afterEach(() => {
    envCorePromptVersionSpy.mockRestore();
    envSubtasksPromptVersionSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("should call create prompts and execute parse with each prompt", async () => {
    await executeHandler();

    expect(mockedCreateCorePrompt).toHaveBeenCalledWith(
      mockPromptVersion,
      mockNaturalLanguage,
      mockParseTaskInputConfig
    );
    expect(mockedExecuteParse).toHaveBeenCalledWith(
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_CORE_OPERATION,
      mockNaturalLanguage,
      mockPrompt,
      mockPromptVersion,
      mockAiServiceRequestId
    );
    expect(mockedCreateSubtasksPrompt).toHaveBeenCalledWith(
      mockPromptVersion,
      mockNaturalLanguage
    );
    expect(mockedExecuteParse).toHaveBeenCalledWith(
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_SUBTASKS_OPERATION,
      mockNaturalLanguage,
      mockPrompt,
      mockPromptVersion,
      mockAiServiceRequestId
    );
  });

  it("should return core result with null subtasks without metadata when subtasks call throws error", async () => {
    const apiError = new Error("ExecuteParse Error");

    mockedExecuteParse.mockReset();
    mockedExecuteParse
      .mockResolvedValueOnce(mockExecuteParseCoreResponse)
      .mockRejectedValueOnce(apiError);

    const response = await executeHandler();

    expect(response.openaiMetadata.core).toEqual({
      responseId: mockOpenaiResponseId,
      tokens: mockOpenaiTokenUsage,
      durationMs: mockOpenaiDurationMs,
    });
    expect(response.openaiMetadata.subtasks).toBeUndefined();
    expect(response.result).toEqual({
      ...mockParseTaskOutput,
      subtasks: null,
    });
  });

  describe("v1 core behavior", () => {
    it("should handle success", async () => {
      const response = await executeHandler();

      expect(response.openaiMetadata.core).toEqual({
        responseId: mockOpenaiResponseId,
        tokens: mockOpenaiTokenUsage,
        durationMs: mockOpenaiDurationMs,
      });
      expect(response.openaiMetadata.subtasks).toEqual({
        responseId: mockOpenaiResponseId,
        tokens: mockOpenaiTokenUsage,
        durationMs: mockOpenaiDurationMs,
      });
      expect(response.result).toEqual({
        ...mockParseTaskOutput,
        subtasks: null,
      });
    });
  });

  describe("v2 core behavior", () => {
    beforeEach(() => {
      envCorePromptVersionSpy.mockReturnValue("v2");

      mockedExecuteParse.mockReset();
      mockedExecuteParse
        .mockResolvedValueOnce({
          openaiResponseId: mockOpenaiResponseId,
          output: mockParseTaskSuccessOutputCoreV2,
          usage: {
            tokens: mockOpenaiTokenUsage,
          },
          durationMs: mockOpenaiDurationMs,
        })
        .mockResolvedValueOnce(mockExecuteParseSubtasksResponse);
    });

    it("should handle success", async () => {
      const response = await executeHandler();

      expect(response.openaiMetadata.core).toEqual({
        responseId: mockOpenaiResponseId,
        tokens: mockOpenaiTokenUsage,
        durationMs: mockOpenaiDurationMs,
      });
      expect(response.openaiMetadata.subtasks).toEqual({
        responseId: mockOpenaiResponseId,
        tokens: mockOpenaiTokenUsage,
        durationMs: mockOpenaiDurationMs,
      });
      expect(response.result).toEqual({
        ...mockParseTaskOutput,
        subtasks: null,
      });
    });

    it("should throw BadRequestError for vague input", async () => {
      mockedExecuteParse.mockReset();
      mockedExecuteParse.mockResolvedValueOnce({
        openaiResponseId: mockOpenaiResponseId,
        output: mockParseTaskErrorOutputCoreV2,
        usage: {
          tokens: mockOpenaiTokenUsage,
        },
        durationMs: mockOpenaiDurationMs,
      });

      try {
        await executeHandler();

        expect.fail("Should have thrown BadRequestError");
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError);

        const { message, context } = error as BadRequestError;

        expect(message).toBe(mockParseTaskErrorOutputCoreV2.error?.reason);
        expect(context?.type).toBe(AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR);
        expect(context?.suggestions).toEqual(
          mockParseTaskErrorOutputCoreV2.error?.suggestions
        );
        expect(context?.openaiResponseId).toBe(mockOpenaiResponseId);
      }
    });
  });
});
