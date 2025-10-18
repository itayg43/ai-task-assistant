import { ParseTaskInputConfig } from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV1 } from "@capabilities/parse-task/parse-task-prompts/parse-task-core-prompt/v1";

const PROMPT_VERSIONS = {
  v1: parseTaskCorePromptV1,
};

export const createParseTaskCorePrompt = (
  version: keyof typeof PROMPT_VERSIONS,
  naturalLanguage: string,
  config: ParseTaskInputConfig
) => {
  return PROMPT_VERSIONS[version](naturalLanguage, config);
};
