import { ParseTaskConfig } from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV1 } from "./parse-task-core-prompt-v1";

const PROMPT_VERSIONS = {
  v1: parseTaskCorePromptV1,
};

export const createParseTaskCorePrompt = (
  version: keyof typeof PROMPT_VERSIONS,
  naturalLanguage: string,
  config: ParseTaskConfig
) => {
  return PROMPT_VERSIONS[version](naturalLanguage, config);
};
