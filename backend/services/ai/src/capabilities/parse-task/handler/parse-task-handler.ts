import {
  PARSE_TASK_CAPABILITY,
  PARSE_TASK_CORE_OPERATION,
  PARSE_TASK_SUBTASKS_OPERATION,
} from "@capabilities/parse-task/parse-task-constants";
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
import { ParseTaskCorePromptVersion } from "@capabilities/parse-task/prompts/core";
import { ParseTaskSubtasksPromptVersion } from "@capabilities/parse-task/prompts/subtasks";
import { executeParse } from "@clients/openai";
import { env } from "@config/env";
import { AI_ERROR_TYPE } from "@constants";
import { createLogger } from "@shared/config/create-logger";
import { BadRequestError } from "@shared/errors";
import { exhaustiveSwitch } from "@shared/utils/exhaustive-switch";
import { CapabilityResponse } from "@types";
import { detectInjection } from "@utils/prompt-injection-detector";

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
        PARSE_TASK_CAPABILITY,
        PARSE_TASK_CORE_OPERATION,
        naturalLanguage,
        prompt,
        promptVersion,
        requestId
      );
    },
    v2: async () => {
      const { openaiResponseId, usage, output, durationMs } =
        await executeParse<ParseTaskOutputCoreV2>(
          PARSE_TASK_CAPABILITY,
          PARSE_TASK_CORE_OPERATION,
          naturalLanguage,
          prompt,
          promptVersion,
          requestId
        );

      if (!output.success) {
        const { error } = output;

        throw new BadRequestError(error.reason, {
          type: AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR,
          suggestions: error.suggestions,
          openaiMetadata: {
            core: {
              responseId: openaiResponseId,
              tokens: usage.tokens,
              durationMs,
            },
          },
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
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_SUBTASKS_OPERATION,
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

  const validatedInput = detectInjection(naturalLanguage, requestId);

  const corePromptVersion = env.PARSE_TASK_CORE_PROMPT_VERSION;
  const coreResponse = await coreHandler(
    corePromptVersion,
    validatedInput,
    config,
    requestId
  );

  const subtasksPromptVersion = env.PARSE_TASK_SUBTASKS_PROMPT_VERSION;
  const subtasksResponse = await subtasksHandler(
    subtasksPromptVersion,
    validatedInput,
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
