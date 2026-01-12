import { prisma } from "@clients/prisma";
import { createManySubtasks } from "@repositories/subtasks-repository";
import { createTask, findTaskById } from "@repositories/tasks-repository";
import { TParsedTask } from "@types";

export const createTaskHandler = async (
  userId: number,
  parsedTask: TParsedTask
) => {
  return await prisma.$transaction(async (tx) => {
    const createdTask = await createTask(tx, userId, parsedTask);

    if (parsedTask.subtasks && parsedTask.subtasks.length > 0) {
      await createManySubtasks(tx, createdTask.id, userId, parsedTask.subtasks);
    }

    const taskWithSubtasks = await findTaskById(tx, createdTask.id, userId);
    return taskWithSubtasks!;
  });
};
