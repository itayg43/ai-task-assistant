import { parseTask } from "@services/ai-capabilities-service";
import { ParseTaskConfig } from "@types";

export const createTaskHandler = async (
  naturalLanguage: string,
  config: ParseTaskConfig
) => {
  const response = await parseTask(naturalLanguage, config);

  return response.result;
};
