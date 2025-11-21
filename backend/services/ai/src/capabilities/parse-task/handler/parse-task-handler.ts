import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInput,
  ParseTaskOutputCore,
} from "@capabilities/parse-task/parse-task-types";
import { createParseTaskCorePrompt } from "@capabilities/parse-task/prompts";
import { executeParse } from "@clients/openai";
import { env } from "@config/env";
import { CapabilityResponse } from "@types";

export const parseTaskHandler = async (
  input: ParseTaskInput,
  requestId: string
): Promise<CapabilityResponse<typeof parseTaskOutputSchema>> => {
  const { naturalLanguage, config } = input.body;

  const corePrompt = createParseTaskCorePrompt(
    env.PARSE_TASK_CORE_PROMPT_VERSION,
    naturalLanguage,
    config
  );
  const coreResponse = await executeParse<ParseTaskOutputCore>(
    "parse-task",
    naturalLanguage,
    corePrompt,
    requestId
  );

  return {
    openaiMetadata: {
      responseId: coreResponse.openaiResponseId,
      tokens: {
        input: coreResponse.usage.tokens.input,
        output: coreResponse.usage.tokens.output,
      },
      durationMs: coreResponse.durationMs,
    },
    result: coreResponse.output,
  };
};
