import { prisma } from "@clients/prisma";
import { DEFAULT_PARSE_TASK_CONFIG } from "@constants";
import { createManySubtasks } from "@repositories/subtasks-repository";
import {
  createTask,
  findTaskById,
  type TaskWithSubtasks,
} from "@repositories/tasks-repository";
import { executeCapability } from "@services/ai-capabilities-service";
import { TParsedTask } from "@types";

export const createTaskHandler = async (
  requestId: string,
  userId: number,
  naturalLanguage: string
): Promise<TaskWithSubtasks> => {
  const { result: parsedTask } = await executeCapability<
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

  return await prisma.$transaction(async (tx) => {
    const createdTask = await createTask(
      tx,
      userId,
      naturalLanguage,
      parsedTask
    );

    if (parsedTask.subtasks && parsedTask.subtasks.length > 0) {
      await createManySubtasks(tx, createdTask.id, userId, parsedTask.subtasks);
    }

    const taskWithSubtasks = await findTaskById(tx, createdTask.id);

    return taskWithSubtasks!;
  });
};
