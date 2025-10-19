import { ParseTaskOutputCore } from "@capabilities/parse-task/parse-task-types";
import { corePromptV1 } from "@capabilities/parse-task/prompts/core/v1";
import { mockInputConfig } from "@capabilities/parse-task/prompts/core/v1/evals/helpers/mock-input-config";
import {
  createJudgePrompt,
  Judge,
} from "@capabilities/parse-task/prompts/core/v1/evals/utils/create-judge-prompt";
import { executeParse } from "@clients/openai";

export const executeParseTask = async (naturalLanguage: string) => {
  const prompt = corePromptV1(naturalLanguage, mockInputConfig);
  const response = await executeParse<ParseTaskOutputCore>(prompt);

  if (!response.output_parsed) {
    throw new Error(`Failed to parse: ${naturalLanguage}`);
  }

  return response.output_parsed;
};

export const executeJudgeOutput = async (
  naturalLanguage: string,
  output: ParseTaskOutputCore
) => {
  const prompt = createJudgePrompt(naturalLanguage, output, mockInputConfig);
  const response = await executeParse<Judge>(prompt);

  if (!response.output_parsed) {
    throw new Error(`Failed to judge: ${naturalLanguage}`);
  }

  return response.output_parsed;
};
