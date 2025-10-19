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

  return await executeParse<ParseTaskOutputCore>(
    "parse-task",
    naturalLanguage,
    prompt
  );
};

export const executeJudgeOutput = async (
  naturalLanguage: string,
  output: ParseTaskOutputCore
) => {
  const prompt = createJudgePrompt(naturalLanguage, output, mockInputConfig);

  return await executeParse<Judge>("parse-task", naturalLanguage, prompt);
};
