import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInput,
  ParseTaskOutputCore,
} from "@capabilities/parse-task/parse-task-types";
import { createParseTaskCorePrompt } from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import { CapabilityResponse } from "@types";

export const parseTaskHandler = async (
  input: ParseTaskInput,
  requestId: string
): Promise<CapabilityResponse<typeof parseTaskOutputSchema>> => {
  const { naturalLanguage, config } = input.body;

  const corePrompt = createParseTaskCorePrompt("v1", naturalLanguage, config);
  const coreResponse = await executeParse<ParseTaskOutputCore>(
    "parse-task",
    naturalLanguage,
    corePrompt,
    requestId
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
