import { Prisma, PrismaClient } from "@shared/clients/prisma";
import { PrismaTransactionClient } from "@shared/types";
import { TParsedTask } from "@types";

export type Task = Prisma.TaskGetPayload<{}>;

export type TaskWithSubtasks = Prisma.TaskGetPayload<{
  include: {
    subtasks: true;
  };
}>;

// Exclude: filters a union type (removes "subtasks" from the union of keys)
export type TaskOrderByFields = Exclude<
  keyof Prisma.TaskOrderByWithRelationInput,
  "subtasks"
>;

export type TaskWhereFields = Omit<
  Prisma.TaskWhereInput,
  "userId" | "subtasks"
>;

export type FindTasksOptions = {
  skip: number;
  take: number;
  orderBy: TaskOrderByFields;
  orderDirection: Prisma.SortOrder;
  where?: TaskWhereFields;
};

export type FindTasksResult = {
  tasks: TaskWithSubtasks[];
  totalCount: number;
  hasMore: boolean;
};

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

export const findTasks = async (
  client: PrismaClient | PrismaTransactionClient,
  userId: number,
  options: FindTasksOptions
): Promise<FindTasksResult> => {
  const { skip, take, orderBy, orderDirection, where: optionalWhere } = options;

  const where: Prisma.TaskWhereInput = {
    userId,
    ...optionalWhere,
  };

  const [tasks, totalCount] = await Promise.all([
    client.task.findMany({
      where,
      orderBy: {
        [orderBy]: orderDirection,
      },
      skip,
      take,
      include: {
        subtasks: true,
      },
    }),
    client.task.count({
      where,
    }),
  ]);

  return {
    tasks,
    totalCount,
    hasMore: skip + take < totalCount,
  };
};
