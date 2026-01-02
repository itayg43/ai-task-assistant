import dotenv from "dotenv";
import { cleanEnv, port, str, url } from "envalid";

import {
  PARSE_TASK_CORE_PROMPT_VERSIONS,
  PARSE_TASK_SUBTASKS_PROMPT_VERSIONS,
} from "@capabilities/parse-task/parse-task-constants";

dotenv.config();

export const env = cleanEnv(process.env, {
  SERVICE_NAME: str(),
  SERVICE_PORT: port(),

  TASKS_SERVICE_URL: url(),

  OPENAI_API_KEY: str(),

  RABBITMQ_URL: url(),

  PARSE_TASK_CORE_PROMPT_VERSION: str({
    choices: PARSE_TASK_CORE_PROMPT_VERSIONS,
  }),
  PARSE_TASK_SUBTASKS_PROMPT_VERSION: str({
    choices: PARSE_TASK_SUBTASKS_PROMPT_VERSIONS,
  }),
});
