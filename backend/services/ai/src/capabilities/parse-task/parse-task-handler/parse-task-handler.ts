import { parseTaskPrompt } from "@capabilities/parse-task/parse-task-prompt";
import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskInput } from "@capabilities/parse-task/parse-task-types";
import { openai } from "@clients/openai";

export const parseTaskHandler = async (input: ParseTaskInput) => {
  const { naturalLanguage } = input.body;

  const prompt = parseTaskPrompt(naturalLanguage);
  const response = await openai.responses.create(prompt);
  const parsedResponse = JSON.parse(response.output_text);
  const parsedTask = parseTaskOutputSchema.parse(parsedResponse);

  return parsedTask;
};
