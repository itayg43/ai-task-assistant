import { prisma } from "@clients/prisma";
import { DEFAULT_PARSE_TASK_CONFIG } from "@constants";
import {
  findTasks,
  type FindTasksOptions,
  type FindTasksResult,
} from "@repositories/tasks-repository";
import { executeCapability } from "@services/ai-capabilities-service";

export const createTaskHandler = async (
  requestId: string,
  naturalLanguage: string
): Promise<string> => {
  const { message } = await executeCapability<"parse-task">(requestId, {
    capability: "parse-task",
    callbackUrl: "http://tasks:3001/api/v1/webhooks/create-task",
    params: {
      naturalLanguage,
      config: DEFAULT_PARSE_TASK_CONFIG,
    },
  });

  return message;
};

export const getTasksHandler = async (
  userId: number,
  options: FindTasksOptions
): Promise<FindTasksResult> => {
  return await findTasks(prisma, userId, options);
};
