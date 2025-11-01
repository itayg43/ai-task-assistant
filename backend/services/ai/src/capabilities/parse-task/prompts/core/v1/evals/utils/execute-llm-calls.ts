import { mockParseTaskInputConfig } from "@capabilities/parse-task/parse-task-mocks";
import { ParseTaskOutputCore } from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV1 } from "@capabilities/parse-task/prompts/core/v1";
import {
  createJudgePrompt,
  Judge,
} from "@capabilities/parse-task/prompts/core/v1/evals/utils/create-judge-prompt";
import { executeParse } from "@clients/openai";

export const executeParseTask = async (naturalLanguage: string) => {
  const prompt = parseTaskCorePromptV1(
    naturalLanguage,
    mockParseTaskInputConfig
  );

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
  const prompt = createJudgePrompt(
    naturalLanguage,
    output,
    mockParseTaskInputConfig
  );

  return await executeParse<Judge>("parse-task", naturalLanguage, prompt);
};
