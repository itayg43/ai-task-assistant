import { parseTaskPrompt } from "@capabilities/parse-task/parse-task-prompt";
import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import { openai } from "@clients/openai";
import { createLogger } from "@shared/config/create-logger";
import { getCurrentTime } from "@shared/utils/date-time";
import { ParseTaskInput } from "../parse-task-types";

const logger = createLogger("parseTaskHandler");

export const parseTaskHandler = async (input: ParseTaskInput) => {
  const { naturalLanguage } = input.body;

  logger.info("parseTask - starting", {
    naturalLanguage,
  });

  const prompt = parseTaskPrompt(naturalLanguage);

  const startTimestamp = getCurrentTime();
  const aiResponse = await openai.responses.create(prompt);
  const duration = getCurrentTime() - startTimestamp;

  logger.info("parseTask - ai response received", {
    outputText: aiResponse.output_text,
    usage: aiResponse.usage,
    duration: `${duration.toFixed(2)}ms`,
  });

  const parsedAiResponse = JSON.parse(aiResponse.output_text);
  const parsedTask = parseTaskOutputSchema.parse(parsedAiResponse);

  logger.info("parseTask - completed successfully", {
    parsedTask,
  });

  return parsedTask;
};
