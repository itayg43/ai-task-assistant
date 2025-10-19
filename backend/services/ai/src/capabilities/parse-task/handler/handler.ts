import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInput,
  ParseTaskOutputCore,
} from "@capabilities/parse-task/parse-task-types";
import { createCorePrompt } from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import { CapabilityResponse } from "@types";

export const handler = async (
  input: ParseTaskInput
): Promise<CapabilityResponse<typeof parseTaskOutputSchema>> => {
  const { naturalLanguage, config } = input.body;

  const corePrompt = createCorePrompt("v1", naturalLanguage, config);
  const coreResponse = await executeParse<ParseTaskOutputCore>(
    "parse-task",
    naturalLanguage,
    corePrompt
  );

  return {
    metadata: {
      tokens: {
        input: coreResponse.usage.tokens.input,
        output: coreResponse.usage.tokens.output,
      },
      durationMs: coreResponse.durationMs,
    },
    result: coreResponse.output,
  };
};
