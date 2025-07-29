import { openai } from "@clients/openai";
import { createLogger } from "@config/logger";
import { parseTaskPrompt } from "@modules/tasks/tasks-prompts";
import { parseTaskOutputSchema } from "@modules/tasks/tasks-schemas";
import { getCurrentTime } from "@utils/time-date";

const logger = createLogger("tasksAiService");

export const parseTask = async (naturalLanguage: string) => {
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
