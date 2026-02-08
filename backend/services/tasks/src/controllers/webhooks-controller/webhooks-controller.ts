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
  const { tasksServiceRequestId } = getValidatedQuery<CreateTaskWebhookInput["query"]>(res);

  logger.info("Received callback from AI service", {
    aiServiceRequestId,
    tasksServiceRequestId,
    success,
  });

  try {
    if (!success) {
      logger.warn("Callback indicates failure, skipping task creation", {
        requestId: aiServiceRequestId,
        error: req.body.error,
      });

      recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, aiServiceRequestId);

      if (
        req.body.error?.context?.type ===
        AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR
      ) {
        recordVagueInput(aiServiceRequestId);
      } else if (
        req.body.error?.context?.type ===
        AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED
      ) {
        recordPromptInjection(TASKS_OPERATION.CREATE_TASK, aiServiceRequestId);
      }

      res.sendStatus(StatusCodes.OK);

      return;
    }

    const { result } = req.body;
    logger.info("Starting task creation from callback", {
      aiServiceRequestId,
      tasksServiceRequestId,
    });

    await createTaskHandler(userId, result.result);

    logger.info("Task created successfully from callback", {
      aiServiceRequestId,
      tasksServiceRequestId,
    });

    res.sendStatus(StatusCodes.OK);

    // Background: Reconcile token usage and record metrics (non-blocking)
    // These operations are non-critical and should not delay webhook response
    // Note: reconcileTokenUsageFromCallback has internal error handling and never throws
    const actualTokens = extractOpenaiTokenUsage(result.openaiMetadata) ?? 0;
    void reconcileTokenUsageFromCallback(
      redis,
      redlock,
      tasksServiceRequestId,
      actualTokens,
      env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
    ).then((startTime) => {
      const durationMs = startTime !== null ? Date.now() - startTime : 0;
      recordTasksApiSuccess(
        TASKS_OPERATION.CREATE_TASK,
        durationMs,
        aiServiceRequestId,
      );
    });
  } catch (error) {
    logger.error("Failed to create task from callback", error, {
      aiServiceRequestId,
      tasksServiceRequestId,
    });

    res.sendStatus(StatusCodes.OK);

    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, aiServiceRequestId);
  }
};
