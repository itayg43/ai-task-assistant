import dotenv from "dotenv";
import { cleanEnv, port, str } from "envalid";

import {
  PARSE_TASK_CORE_PROMPT_VERSIONS,
  PARSE_TASK_SUBTASKS_PROMPT_VERSIONS,
} from "@capabilities/parse-task/parse-task-constants";

dotenv.config();

export const env = cleanEnv(process.env, {
  SERVICE_NAME: str(),
  SERVICE_PORT: port(),

  OPENAI_API_KEY: str(),

  PARSE_TASK_CORE_PROMPT_VERSION: str({
    choices: PARSE_TASK_CORE_PROMPT_VERSIONS,
  }),

  PARSE_TASK_SUBTASKS_PROMPT_VERSION: str({
    choices: PARSE_TASK_SUBTASKS_PROMPT_VERSIONS,
  }),
});
