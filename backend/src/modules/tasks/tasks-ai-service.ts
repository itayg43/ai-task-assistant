import { openai } from "@clients/openai";
import { parseTaskPrompt } from "@modules/tasks/tasks-prompts";
import { parseTaskOutputSchema } from "@modules/tasks/tasks-schemas";

export const parseTask = async (naturalLanguage: string) => {
  const prompt = parseTaskPrompt(naturalLanguage);
  const aiResponse = await openai.responses.create(prompt);
  const parsedAiResponse = JSON.parse(aiResponse.output_text);
  const parsedTask = parseTaskOutputSchema.parse(parsedAiResponse);

  return parsedTask;
};
