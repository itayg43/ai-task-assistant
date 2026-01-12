import { prisma } from "@clients/prisma";
import { createManySubtasks } from "@repositories/subtasks-repository";
import { createTask, findTaskById } from "@repositories/tasks-repository";
import { TOpenaiMetadataRecord, TParsedTask } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

export const createTaskHandler = async (
  userId: number,
  naturalLanguage: string,
  parsedTask: TParsedTask,
  openaiMetadata: TOpenaiMetadataRecord
) => {
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

  const tokensUsed = extractOpenaiTokenUsage(openaiMetadata);
};
