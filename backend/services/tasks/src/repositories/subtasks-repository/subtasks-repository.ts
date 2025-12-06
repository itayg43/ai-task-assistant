import { Prisma, PrismaClient } from "@shared/clients/prisma";
import { PrismaTransactionClient } from "@shared/types";

export type Subtask = Prisma.SubtaskGetPayload<{}>;

export const createManySubtasks = async (
  client: PrismaClient | PrismaTransactionClient,
  taskId: number,
  userId: number,
  subtasks: string[]
) => {
  return await client.subtask.createMany({
    data: subtasks.map((title, idx) => ({
      taskId,
      userId,
      title,
      order: idx,
    })),
  });
};
