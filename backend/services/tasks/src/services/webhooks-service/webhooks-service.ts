import { prisma } from "@clients/prisma";
import { redis } from "@clients/redis";
import { redlock } from "@clients/redlock";
import { env } from "@config/env";
import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  recordTasksApiFailure,
  recordTasksApiSuccess,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import { createManySubtasks } from "@repositories/subtasks-repository";
import { createTask, findTaskById } from "@repositories/tasks-repository";
import { reconcileTokenUsage } from "@services/token-usage-service";
import { createLogger } from "@shared/config/create-logger";
import type { RequestMetadata } from "@shared/types";
import type {
  CreateTaskWebhookFailureInput,
  CreateTaskWebhookSuccessInput,
  TOpenaiMetadataRecord,
} from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

type RequestIds = {
  tasksServiceRequestId: string;
  aiServiceRequestId: string;
};

const logger = createLogger("webhooksService");

export const createTaskSuccessCallbackHandler = async (
  requestIds: RequestIds,
  metadata: RequestMetadata,
  parsedTask: CreateTaskWebhookSuccessInput["result"]["result"],
  openaiMetadata: CreateTaskWebhookSuccessInput["result"]["openaiMetadata"],
) => {
  const { tasksServiceRequestId } = requestIds;
  const { userId } = metadata;

  try {
    const createdTask = await prisma.$transaction(async (tx) => {
      const task = await createTask(tx, userId, parsedTask);

      if (parsedTask.subtasks && parsedTask.subtasks.length > 0) {
        await createManySubtasks(tx, task.id, userId, parsedTask.subtasks);
      }

      return (await findTaskById(tx, task.id, userId))!;
    });

    logger.info("Task created successfully from callback", requestIds);

    recordTasksApiSuccess(
      TASKS_OPERATION.CREATE_TASK,
      metadata.startTime,
      tasksServiceRequestId,
    );

    return createdTask;
  } catch (error) {
    logger.error("Failed to create task from callback", error, requestIds);

    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, tasksServiceRequestId);
  } finally {
    void reconcileTokenUsage(
      redis,
      redlock,
      metadata,
      extractOpenaiTokenUsage(openaiMetadata),
      env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
    );
  }
};

export const createTaskFailureCallbackHandler = (
  requestIds: RequestIds,
  metadata: RequestMetadata,
  error: CreateTaskWebhookFailureInput["error"],
) => {
  const { tasksServiceRequestId } = requestIds;
  const { context } = error;

  let openaiMetadata: TOpenaiMetadataRecord | undefined;

  logger.error(
    "Create task callback indicates failure, skipping creation",
    error,
    requestIds,
  );

  recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, tasksServiceRequestId);

  if (context.type === AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR) {
    openaiMetadata = context.openaiMetadata;

    recordVagueInput(tasksServiceRequestId);
  }

  void reconcileTokenUsage(
    redis,
    redlock,
    metadata,
    openaiMetadata ? extractOpenaiTokenUsage(openaiMetadata) : 0,
    env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
  );
};
