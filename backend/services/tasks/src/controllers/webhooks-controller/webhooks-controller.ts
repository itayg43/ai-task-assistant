import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { redis } from "@clients/redis";
import { redlock } from "@clients/redlock";
import { env } from "@config/env";
import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  recordPromptInjection,
  recordTasksApiFailure,
  recordTasksApiSuccess,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import { reconcileTokenUsageFromCallback } from "@services/token-usage-service";
import { createTaskHandler } from "@services/webhooks-service";
import { createLogger } from "@shared/config/create-logger";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { getValidatedQuery } from "@shared/utils/validated-query";
import { CreateTaskWebhookInput } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

const logger = createLogger("webhooksController");

export const createTask = async (
  req: Request<unknown, unknown, CreateTaskWebhookInput["body"]>,
  res: Response,
  _next: NextFunction,
) => {
  const { userId } = getAuthenticationContext(res);
  const { aiServiceRequestId, success } = req.body;
  const { tasksServiceRequestId } =
    getValidatedQuery<CreateTaskWebhookInput["query"]>(res);

  try {
    res.sendStatus(StatusCodes.OK);

    if (!success) {
      logger.error(
        "create task callback indicates failure, skipping creation",
        req.body.error,
        {
          aiServiceRequestId,
          tasksServiceRequestId,
        },
      );

      recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, tasksServiceRequestId);

      const { error } = req.body;
      if (error.context.type === AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR) {
        recordVagueInput(tasksServiceRequestId);

        const { openaiMetadata } = error.context;
        void reconcileTokenUsageFromCallback(
          redis,
          redlock,
          tasksServiceRequestId,
          extractOpenaiTokenUsage(openaiMetadata),
          env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
        );
      } else if (
        error.context.type === AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED
      ) {
        recordPromptInjection(
          TASKS_OPERATION.CREATE_TASK,
          tasksServiceRequestId,
        );
      }

      return;
    }

    const {
      result: { result, openaiMetadata },
    } = req.body;

    await createTaskHandler(userId, result);

    logger.info("Task created successfully from callback", {
      aiServiceRequestId,
      tasksServiceRequestId,
    });

    void reconcileTokenUsageFromCallback(
      redis,
      redlock,
      tasksServiceRequestId,
      extractOpenaiTokenUsage(openaiMetadata),
      env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
    ).then((startTime) => {
      const durationMs = startTime ? Date.now() - startTime : 0;
      recordTasksApiSuccess(
        TASKS_OPERATION.CREATE_TASK,
        durationMs,
        tasksServiceRequestId,
      );
    });
  } catch (error) {
    logger.error("Failed to create task from callback", error, {
      aiServiceRequestId,
      tasksServiceRequestId,
    });

    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, tasksServiceRequestId);
  }
};
