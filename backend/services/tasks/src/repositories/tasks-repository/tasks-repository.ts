import { Prisma, PrismaClient } from "@shared/clients/prisma";
import { PrismaTransactionClient } from "@shared/types";
import { TParsedTask } from "@types";

export type Task = Prisma.TaskGetPayload<{}>;

export type TaskWithSubtasks = Prisma.TaskGetPayload<{
  include: {
    subtasks: true;
  };
}>;

export const createTask = async (
  client: PrismaClient | PrismaTransactionClient,
  userId: number,
  naturalLanguage: string,
  parsedTask: TParsedTask
): Promise<Task> => {
  const { title, dueDate, category, priority } = parsedTask;

  return await client.task.create({
    data: {
      userId,
      naturalLanguage,
      title,
      dueDate: dueDate ? new Date(dueDate) : null,
      category,
      priorityLevel: priority.level,
      priorityScore: priority.score,
      priorityReason: priority.reason,
    },
  });
};

export const findTaskById = async (
  client: PrismaClient | PrismaTransactionClient,
  taskId: number,
  userId: number
): Promise<TaskWithSubtasks | null> => {
  return await client.task.findUnique({
    where: {
      id: taskId,
      userId,
    },
    include: {
      subtasks: true,
    },
  });
};
