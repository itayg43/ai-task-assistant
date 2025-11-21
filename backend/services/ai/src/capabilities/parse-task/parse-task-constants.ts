import {
  PARSE_TASK_CORE_PROMPT_VERSIONS as CORE_PROMPT_VERSIONS,
  ParseTaskCorePromptVersion,
} from "@capabilities/parse-task/prompts/core";

export const PARSE_TASK_CORE_PROMPT_VERSIONS = Object.keys(
  CORE_PROMPT_VERSIONS
) as ParseTaskCorePromptVersion[];
