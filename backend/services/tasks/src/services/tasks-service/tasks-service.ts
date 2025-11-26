import { DEFAULT_PARSE_TASK_CONFIG } from "@constants";
import { executeCapability } from "@services/ai-capabilities-service";
import { TParsedTask } from "@types";

export const createTaskHandler = async (
  requestId: string,
  naturalLanguage: string
) => {
  const response = await executeCapability<"parse-task", TParsedTask>(
    requestId,
    {
      capability: "parse-task",
      pattern: "sync",
      params: {
        naturalLanguage,
        config: DEFAULT_PARSE_TASK_CONFIG,
      },
    }
  );

  return response.result;
};

