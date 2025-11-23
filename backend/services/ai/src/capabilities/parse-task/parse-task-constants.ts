import {
  PARSE_TASK_CORE_PROMPT_VERSIONS as CORE_PROMPT_VERSIONS,
  ParseTaskCorePromptVersion,
} from "@capabilities/parse-task/prompts/core";
import {
  ParseTaskSubtasksPromptVersion,
  PARSE_TASK_SUBTASKS_PROMPT_VERSIONS as SUBTASKS_PROMPT_VERSIONS,
} from "@capabilities/parse-task/prompts/subtasks";

export const PARSE_TASK_CORE_PROMPT_VERSIONS = Object.keys(
  CORE_PROMPT_VERSIONS
) as ParseTaskCorePromptVersion[];

export const PARSE_TASK_SUBTASKS_PROMPT_VERSIONS = Object.keys(
  SUBTASKS_PROMPT_VERSIONS
) as ParseTaskSubtasksPromptVersion[];
