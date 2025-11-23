import { parseTaskSubtasksPromptV1 } from "@capabilities/parse-task/prompts/subtasks/v1";

export const PARSE_TASK_SUBTASKS_PROMPT_VERSIONS = {
  v1: parseTaskSubtasksPromptV1,
} as const;

export type ParseTaskSubtasksPromptVersion =
  keyof typeof PARSE_TASK_SUBTASKS_PROMPT_VERSIONS;

export const createParseTaskSubtasksPrompt = (
  version: ParseTaskSubtasksPromptVersion,
  naturalLanguage: string
) => {
  return PARSE_TASK_SUBTASKS_PROMPT_VERSIONS[version](naturalLanguage);
};
