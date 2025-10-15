import { createParseTaskCorePrompt } from "@capabilities/parse-task/parse-task-prompts";
import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInput,
  ParseTaskOutput,
} from "@capabilities/parse-task/parse-task-types";
import { openai } from "@clients/openai";
import { predefinedTokenCounters } from "@shared/utils/count-tokens";
import { withDurationAsync } from "@shared/utils/with-duration";
import { CapabilityResponse } from "@types";

export const parseTaskHandler = async (
  input: ParseTaskInput
): Promise<CapabilityResponse<typeof parseTaskOutputSchema>> => {
  const { naturalLanguage, config } = input.body;

  const corePrompt = createParseTaskCorePrompt("v1", naturalLanguage, config);
  const corePromptResponse = await withDurationAsync(() =>
    openai.responses.parse<any, ParseTaskOutput>(corePrompt)
  );

  if (!corePromptResponse.result.output_parsed) {
    throw new Error("Failed to parse task correctly");
  }

  return {
    metadata: {
      tokens: {
        input: predefinedTokenCounters["gpt-4o-mini"](naturalLanguage).count,
        output: corePromptResponse.result.usage?.output_tokens || 0,
      },
      durationMs: corePromptResponse.durationMs,
    },
    result: corePromptResponse.result.output_parsed,
  };
};
