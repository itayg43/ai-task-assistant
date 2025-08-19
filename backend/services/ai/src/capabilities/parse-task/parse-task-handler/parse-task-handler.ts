import { parseTaskPrompt } from "@capabilities/parse-task/parse-task-prompt";
import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskInput } from "@capabilities/parse-task/parse-task-types";
import { openai } from "@clients/openai";
import { createLogger } from "@shared/config/create-logger";
import { getCurrentTime, getElapsedTime } from "@shared/utils/date-time";

const logger = createLogger("parseTaskHandler");

export const parseTaskHandler = async (input: ParseTaskInput) => {
  const { naturalLanguage } = input.body;

  const prompt = parseTaskPrompt(naturalLanguage);

  const startTimestamp = getCurrentTime();
  const response = await openai.responses.create(prompt);
  const duration = getElapsedTime(startTimestamp);

  const metadata = {
    tokens: {
      output: response.usage?.output_tokens,
    },
    duration,
  };

  try {
    const parsedResponse = JSON.parse(response.output_text);
    const parsedTask = parseTaskOutputSchema.parse(parsedResponse);

    return {
      metadata,
      parsedTask,
    };
  } catch (error) {
    logger.error("Parsing error - json / output schema", error, {
      input: {
        naturalLanguage,
      },
      metadata,
      aiResponse: response.output_text,
    });

    throw error;
  }
};
