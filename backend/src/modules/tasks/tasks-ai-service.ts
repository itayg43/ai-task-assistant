import { openai } from "@clients/openai";
import { createLogger } from "@config/logger";
import {
  CATEGORY,
  EMOTIONAL_LANGUAGE,
  FREQUENCY,
  PRIORITY_LEVEL,
  PRIORITY_SCORE,
} from "@modules/tasks/tasks-constants";
import { parseTaskPrompt } from "@modules/tasks/tasks-prompts";
import { createTaskAiResponseSchema } from "@modules/tasks/tasks-schemas";

const logger = createLogger("tasksAiService");

export const parseTask = async (naturalLanguage: string) => {
  const prompt = parseTaskPrompt(
    PRIORITY_LEVEL,
    PRIORITY_SCORE,
    CATEGORY,
    FREQUENCY,
    EMOTIONAL_LANGUAGE
  );

  const aiResponse = await openai.responses.create({
    model: "gpt-4o-mini",
    instructions: prompt,
    input: naturalLanguage,
    temperature: 0,
  });
  const parsedAiResponse = JSON.parse(aiResponse.output_text);
  const validatedAiResponse =
    createTaskAiResponseSchema.parse(parsedAiResponse);

  return validatedAiResponse;
};
