import { parseTask } from "@services/ai-capabilities-service";
import { ParseTaskConfig } from "@types";

export const createTaskHandler = async (
  naturalLanguage: string,
  config: ParseTaskConfig
) => {
  return await parseTask(naturalLanguage, config);
};
