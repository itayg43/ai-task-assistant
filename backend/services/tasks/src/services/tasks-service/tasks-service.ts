import { prisma } from "@clients/prisma";
import { DEFAULT_PARSE_TASK_CONFIG } from "@constants";
import { createManySubtasks } from "@repositories/subtasks-repository";
import {
  createTask,
  findTaskById,
  findTasks,
  type FindTasksOptions,
  type FindTasksResult,
  type TaskWithSubtasks,
} from "@repositories/tasks-repository";
import { executeCapability } from "@services/ai-capabilities-service";
import { TParsedTask } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

export const createTaskHandler = async (
  requestId: string,
  userId: number,
  naturalLanguage: string
): Promise<{ task: TaskWithSubtasks; tokensUsed: number }> => {
  const { result: parsedTask, openaiMetadata } = await executeCapability<
    "parse-task",
    TParsedTask
  >(requestId, {
    capability: "parse-task",
    pattern: "sync",
    params: {
      naturalLanguage,
      config: DEFAULT_PARSE_TASK_CONFIG,
    },
  });

  const tokensUsed = extractOpenaiTokenUsage(openaiMetadata);

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await createTask(
      tx,
      userId,
      naturalLanguage,
      parsedTask
    );

    if (parsedTask.subtasks && parsedTask.subtasks.length > 0) {
      await createManySubtasks(tx, createdTask.id, userId, parsedTask.subtasks);
    }

    const taskWithSubtasks = await findTaskById(tx, createdTask.id, userId);

    return taskWithSubtasks!;
  });

  return {
    task,
    tokensUsed,
  };
};

export const getTasksHandler = async (
  userId: number,
  options: FindTasksOptions
): Promise<FindTasksResult> => {
  return await findTasks(prisma, userId, options);
};
