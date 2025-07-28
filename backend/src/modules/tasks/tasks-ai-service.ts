import { openai } from "@clients/openai";
import {
  CATEGORY,
  EMOTIONAL_LANGUAGE,
  FREQUENCY,
  PRIORITY_LEVEL,
  PRIORITY_SCORE,
} from "@modules/tasks/tasks-constants";
import { parseTaskPrompt } from "@modules/tasks/tasks-prompts";
import { parsedTaskSchema } from "@modules/tasks/tasks-schemas";

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
  const parsedTask = parsedTaskSchema.parse(parsedAiResponse);

  return parsedTask;
};
