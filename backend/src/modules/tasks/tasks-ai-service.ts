import { openai } from "@clients/openai";
import { createLogger } from "@config/logger";
import { parseTaskPrompt } from "@modules/tasks/tasks-prompts";
import { parseTaskOutputSchema } from "@modules/tasks/tasks-schemas";

const logger = createLogger("tasksAiService");

export const parseTask = async (naturalLanguage: string) => {
  const prompt = parseTaskPrompt(naturalLanguage);

  const aiResponse = await openai.responses.create(prompt);
  logger.debug("parseTask - ai response", {
    aiResponse,
  });

  const parsedAiResponse = JSON.parse(aiResponse.output_text);
  logger.debug("parseTask - parsed ai response", {
    parsedAiResponse,
  });

  const parsedTask = parseTaskOutputSchema.parse(parsedAiResponse);
  logger.debug("parseTask - parsed task", {
    parsedTask,
  });

  return parsedTask;
};
