import { ParseTaskInputConfig } from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV1 } from "@capabilities/parse-task/prompts/core/v1";
import { parseTaskCorePromptV2 } from "@capabilities/parse-task/prompts/core/v2";

export const PARSE_TASK_CORE_PROMPT_VERSIONS = {
  v1: parseTaskCorePromptV1,
  v2: parseTaskCorePromptV2,
} as const;

export type ParseTaskCorePromptVersion =
  keyof typeof PARSE_TASK_CORE_PROMPT_VERSIONS;

export const createParseTaskCorePrompt = (
  version: ParseTaskCorePromptVersion,
  naturalLanguage: string,
  config: ParseTaskInputConfig
) => {
  return PARSE_TASK_CORE_PROMPT_VERSIONS[version](naturalLanguage, config);
};
