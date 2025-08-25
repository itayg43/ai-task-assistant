import { parseTask } from "@services/ai-capabilities-service";

export const createTaskHandler = async (naturalLanguage: string) => {
  return await parseTask(naturalLanguage);
};
