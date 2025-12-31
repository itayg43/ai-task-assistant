import { TASKS_OPERATION } from "@constants";

export type TasksOperation =
  (typeof TASKS_OPERATION)[keyof typeof TASKS_OPERATION];
