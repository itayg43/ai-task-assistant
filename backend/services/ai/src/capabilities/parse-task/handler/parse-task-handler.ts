import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInput,
  ParseTaskInputConfig,
  ParseTaskOutputCore,
  ParseTaskOutputCoreV2,
} from "@capabilities/parse-task/parse-task-types";
import { createParseTaskCorePrompt } from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import { env } from "@config/env";
import { BadRequestError } from "@shared/errors";
import { exhaustiveSwitch } from "@shared/utils/exhaustive-switch";
import { CapabilityResponse } from "@types";
import { ParseTaskCorePromptVersion } from "../prompts/core";

/**
 * Core handler that processes parse task requests based on prompt version.
 * Normalizes v1 and v2 responses to a consistent shape:
 * - v1: Returns executeParse result directly (output is ParseTaskOutputCore)
 * - v2: Normalizes response (extracts task from success, throws BadRequestError on error)
 */
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

  return {
    openaiMetadata: {
      responseId: coreResponse.openaiResponseId,
      tokens: coreResponse.usage.tokens,
      durationMs: coreResponse.durationMs,
    },
    result: coreResponse.output,
  };
};
