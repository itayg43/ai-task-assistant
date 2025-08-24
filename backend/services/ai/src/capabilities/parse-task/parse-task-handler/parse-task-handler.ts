import { parseTaskPrompt } from "@capabilities/parse-task/parse-task-prompt";
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
  const { naturalLanguage } = input.body;

  const prompt = parseTaskPrompt(naturalLanguage);

  const { result: response, duration } = await withDurationAsync(() =>
    openai.responses.create(prompt)
  );

  try {
    const parsedResponse = JSON.parse(response.output_text);
    const parsedTask = parseTaskOutputSchema.parse(parsedResponse);

    const { count: inputTokens } =
      predefinedTokenCounters["gpt-4o-mini"](naturalLanguage);

    return {
      metadata: {
        tokens: {
          input: inputTokens,
          output: response.usage?.output_tokens || 0,
        },
        duration: `${duration}ms`,
      },
      result: parsedTask,
    };
  } catch (error) {
    logger.error(
      "Error while parse json/validation schema or count input tokens",
      error,
      {
        input,
        aiResponse: response.output_text,
      }
    );

    throw error;
  }
};
