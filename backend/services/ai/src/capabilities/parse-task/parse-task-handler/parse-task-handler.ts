import { createParseTaskCorePrompt } from "@capabilities/parse-task/parse-task-prompts";
import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskInput } from "@capabilities/parse-task/parse-task-types";
import { openai } from "@clients/openai";
import { createLogger } from "@shared/config/create-logger";
import { predefinedTokenCounters } from "@shared/utils/count-tokens";
import { withDurationAsync } from "@shared/utils/with-duration";
import { CapabilityResponse } from "@types";

const logger = createLogger("parseTaskHandler");

export const parseTaskHandler = async (
  input: ParseTaskInput
): Promise<CapabilityResponse<typeof parseTaskOutputSchema>> => {
  const { naturalLanguage, config } = input.body;

  const corePrompt = createParseTaskCorePrompt("v1", naturalLanguage, config);
  const corePromptResponse = await withDurationAsync(() =>
    openai.responses.create(corePrompt)
  );

  try {
    const parsedResponse = JSON.parse(corePromptResponse.result.output_text);
    const parsedTask = parseTaskOutputSchema.parse(parsedResponse);

    const { count: inputTokens } =
      predefinedTokenCounters["gpt-4o-mini"](naturalLanguage);

    return {
      metadata: {
        tokens: {
          input: inputTokens,
          output: corePromptResponse.result.usage?.output_tokens || 0,
        },
        durationMs: corePromptResponse.durationMs,
      },
      result: parsedTask,
    };
  } catch (error) {
    logger.error(
      "Error while parse json/validation schema or count input tokens",
      error,
      {
        input,
        aiResponse: corePromptResponse.result.output_text,
      }
    );

    throw error;
  }
};
