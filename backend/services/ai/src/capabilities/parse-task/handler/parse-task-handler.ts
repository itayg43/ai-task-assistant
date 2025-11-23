import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInput,
  ParseTaskInputConfig,
  ParseTaskOutputCore,
  ParseTaskOutputCoreV2,
  ParseTaskOutputSubtasks,
} from "@capabilities/parse-task/parse-task-types";
import {
  createParseTaskCorePrompt,
  createParseTaskSubtasksPrompt,
} from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import { env } from "@config/env";
import { createLogger } from "@shared/config/create-logger";
import { BadRequestError } from "@shared/errors";
import { exhaustiveSwitch } from "@shared/utils/exhaustive-switch";
import { CapabilityResponse } from "@types";
import { ParseTaskCorePromptVersion } from "../prompts/core";
import { ParseTaskSubtasksPromptVersion } from "../prompts/subtasks";

const logger = createLogger("parseTaskHandler");

const coreHandler = async (
  promptVersion: ParseTaskCorePromptVersion,
  naturalLanguage: string,
  config: ParseTaskInputConfig,
  requestId: string
) => {
  const prompt = createParseTaskCorePrompt(
    promptVersion,
    naturalLanguage,
    config
  );

  return exhaustiveSwitch(promptVersion, {
    v1: async () => {
      return await executeParse<ParseTaskOutputCore>(
        "parse-task",
        naturalLanguage,
        prompt,
        promptVersion,
        requestId
      );
    },
    v2: async () => {
      const { openaiResponseId, usage, output, durationMs } =
        await executeParse<ParseTaskOutputCoreV2>(
          "parse-task",
          naturalLanguage,
          prompt,
          promptVersion,
          requestId
        );

      if (!output.success) {
        const { error } = output;

        throw new BadRequestError(error.reason, {
          suggestions: error.suggestions,
          aiServiceRequestId: requestId,
          openaiResponseId,
        });
      }

      return {
        openaiResponseId,
        usage,
        output: output.task,
        durationMs,
      };
    },
  });
};

const subtasksHandler = async (
  promptVersion: ParseTaskSubtasksPromptVersion,
  naturalLanguage: string,
  requestId: string
) => {
  try {
    const prompt = createParseTaskSubtasksPrompt(
      promptVersion,
      naturalLanguage
    );

    const response = await executeParse<ParseTaskOutputSubtasks>(
      "parse-task",
      naturalLanguage,
      prompt,
      promptVersion,
      requestId
    );

    return {
      ...response,
      output: response.output.subtasks,
    };
  } catch (error) {
    logger.warn("Create subtasks failed, will be set with default null.", {
      requestId,
    });

    return null;
  }
};

export const parseTaskHandler = async (
  input: ParseTaskInput,
  requestId: string
): Promise<CapabilityResponse<typeof parseTaskOutputSchema>> => {
  const { naturalLanguage, config } = input.body;

  const corePromptVersion = env.PARSE_TASK_CORE_PROMPT_VERSION;
  const coreResponse = await coreHandler(
    corePromptVersion,
    naturalLanguage,
    config,
    requestId
  );

  const subtasksPromptVersion = env.PARSE_TASK_SUBTASKS_PROMPT_VERSION;
  const subtasksResponse = await subtasksHandler(
    subtasksPromptVersion,
    naturalLanguage,
    requestId
  );

  return {
    openaiMetadata: {
      core: {
        responseId: coreResponse.openaiResponseId,
        tokens: coreResponse.usage.tokens,
        durationMs: coreResponse.durationMs,
      },
      ...(subtasksResponse && {
        subtasks: {
          responseId: subtasksResponse.openaiResponseId,
          tokens: subtasksResponse.usage.tokens,
          durationMs: subtasksResponse.durationMs,
        },
      }),
    },
    result: {
      ...coreResponse.output,
      subtasks: subtasksResponse?.output || null,
    },
  };
};
