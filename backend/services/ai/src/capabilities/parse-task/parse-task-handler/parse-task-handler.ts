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

  // TODO: Monitor prompt generation performance and consider Redis caching if:
  // - High frequency of repeated configs (same categories/priorities)
  // - Prompt generation becomes a bottleneck (>1ms consistently)
  // - Multiple service instances could benefit from shared cache
  // Implementation: Cache full generated prompts with config hash as key
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
