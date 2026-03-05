import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { redis } from "@clients/redis";
import { redlock } from "@clients/redlock";
import { env } from "@config/env";
import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  recordMetadataNotFound,
  recordTasksApiFailure,
  recordTasksApiSuccess,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import {
  getRequestMetadata,
  reconcileTokenUsage,
} from "@services/token-usage-service";
import { createTaskHandler } from "@services/webhooks-service";
import { createLogger } from "@shared/config/create-logger";
import { getValidatedQuery } from "@shared/utils/validated-query";
import { CreateTaskWebhookInput } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

const logger = createLogger("webhooksController");

export const createTask = async (
  req: Request<unknown, unknown, CreateTaskWebhookInput["body"]>,
  res: Response,
  _next: NextFunction,
) => {
  const { aiServiceRequestId, success } = req.body;
  const { tasksServiceRequestId } =
    getValidatedQuery<CreateTaskWebhookInput["query"]>(res);

  const metadata = await getRequestMetadata(redis, tasksServiceRequestId);

  if (!metadata) {
    logger.warn("Metadata not found (expired or never existed)", {
      tasksServiceRequestId,
      aiServiceRequestId,
    });

    recordMetadataNotFound(tasksServiceRequestId);

    res.sendStatus(StatusCodes.OK);

    return;
  }

  try {
    if (!success) {
      logger.error(
        "Create task callback indicates failure, skipping creation",
        req.body.error,
        {
          aiServiceRequestId,
          tasksServiceRequestId,
        },
      );

      recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, tasksServiceRequestId);

      const {
        error: { context },
      } = req.body;

      if (context.type === AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR) {
        recordVagueInput(tasksServiceRequestId);

        void reconcileTokenUsage(
          redis,
          redlock,
          metadata,
          extractOpenaiTokenUsage(context.openaiMetadata),
          env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
        );
      } else {
        void reconcileTokenUsage(
          redis,
          redlock,
          metadata,
          0,
          env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
        );
      }

      return;
    }

    const { userId } = metadata;
    const {
      result: { result, openaiMetadata },
    } = req.body;

    await createTaskHandler(userId, result);

    logger.info("Task created successfully from callback", {
      aiServiceRequestId,
      tasksServiceRequestId,
    });

    recordTasksApiSuccess(
      TASKS_OPERATION.CREATE_TASK,
      metadata.startTime,
      tasksServiceRequestId,
    );

    void reconcileTokenUsage(
      redis,
      redlock,
      metadata,
      extractOpenaiTokenUsage(openaiMetadata),
      env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
    );
  } catch (error) {
    logger.error("Failed to create task from callback", error, {
      aiServiceRequestId,
      tasksServiceRequestId,
    });

    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, tasksServiceRequestId);

    void reconcileTokenUsage(
      redis,
      redlock,
      metadata,
      0,
      env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
    );
  } finally {
    res.sendStatus(StatusCodes.OK);
  }
};
