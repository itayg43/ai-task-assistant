import { openai } from "@clients/openai";
import { createLogger } from "@config/logger";
import { parseTaskPrompt } from "@modules/tasks/tasks-prompts";
import { parseTaskOutputSchema } from "@modules/tasks/tasks-schemas";
import { getCurrentTime } from "@utils/time-date";

const logger = createLogger("tasksAiService");

export const parseTask = async (naturalLanguage: string) => {
  const prompt = parseTaskPrompt(naturalLanguage);

  const startTimestamp = getCurrentTime();
  const aiResponse = await openai.responses.create(prompt);
  const duration = getCurrentTime() - startTimestamp;
  logger.debug("parseTask - ai response", {
    aiResponse,
    duration: `${duration.toFixed(2)}ms`,
  });

  const parsedAiResponse = JSON.parse(aiResponse.output_text);
  const parsedTask = parseTaskOutputSchema.parse(parsedAiResponse);
  logger.debug("parseTask - parsed task", {
    parsedTask,
  });

  return parsedTask;
};
