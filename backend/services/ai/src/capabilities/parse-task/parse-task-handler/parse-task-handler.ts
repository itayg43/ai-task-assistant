import { createParseTaskCorePrompt } from "@capabilities/parse-task/parse-task-prompts";
import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInput,
  ParseTaskOutput,
} from "@capabilities/parse-task/parse-task-types";
import { executeParse } from "@clients/openai";
import { withDurationAsync } from "@shared/utils/with-duration";
import { CapabilityResponse } from "@types";

export const parseTaskHandler = async (
  input: ParseTaskInput
): Promise<CapabilityResponse<typeof parseTaskOutputSchema>> => {
  const { naturalLanguage, config } = input.body;

  const corePrompt = createParseTaskCorePrompt("v1", naturalLanguage, config);
  const { result: corePromptResponse, durationMs: corePromptResponseDuration } =
    await withDurationAsync(() => executeParse<ParseTaskOutput>(corePrompt));

  if (!corePromptResponse.output_parsed) {
    throw new Error("Failed to parse task correctly");
  }

  return {
    metadata: {
      tokens: {
        input: corePromptResponse.usage?.input_tokens || 0,
        output: corePromptResponse.usage?.output_tokens || 0,
      },
      durationMs: corePromptResponseDuration,
    },
    result: corePromptResponse.output_parsed,
  };
};
