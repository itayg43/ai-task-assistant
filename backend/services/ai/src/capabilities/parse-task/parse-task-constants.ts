import {
  PARSE_TASK_CORE_PROMPT_VERSIONS as CORE_PROMPT_VERSIONS,
  ParseTaskCorePromptVersion,
} from "@capabilities/parse-task/prompts/core";
import {
  ParseTaskSubtasksPromptVersion,
  PARSE_TASK_SUBTASKS_PROMPT_VERSIONS as SUBTASKS_PROMPT_VERSIONS,
} from "@capabilities/parse-task/prompts/subtasks";
import { CAPABILITY } from "@constants";

export const PARSE_TASK_CORE_PROMPT_VERSIONS = Object.keys(
  CORE_PROMPT_VERSIONS
) as ParseTaskCorePromptVersion[];

export const PARSE_TASK_SUBTASKS_PROMPT_VERSIONS = Object.keys(
  SUBTASKS_PROMPT_VERSIONS
) as ParseTaskSubtasksPromptVersion[];

export const PARSE_TASK_CAPABILITY = CAPABILITY.PARSE_TASK;

export const PARSE_TASK_CORE_OPERATION = "core";

export const PARSE_TASK_SUBTASKS_OPERATION = "subtasks";

export const PARSE_TASK_VAGUE_INPUT_ERROR = "PARSE_TASK_VAGUE_INPUT_ERROR";
