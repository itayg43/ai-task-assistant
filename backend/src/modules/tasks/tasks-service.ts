import { parseTask } from "@modules/tasks/tasks-ai-service";

export const createTaskHandler = async (input: string) => {
  return await parseTask(input);
};
