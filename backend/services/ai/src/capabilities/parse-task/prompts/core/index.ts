import { ParseTaskInputConfig } from "@capabilities/parse-task/parse-task-types";
import { corePromptV1 } from "@capabilities/parse-task/prompts/core/v1";

const PROMPT_VERSIONS = {
  v1: corePromptV1,
};

export const createCorePrompt = (
  version: keyof typeof PROMPT_VERSIONS,
  naturalLanguage: string,
  config: ParseTaskInputConfig
) => {
  return PROMPT_VERSIONS[version](naturalLanguage, config);
};
