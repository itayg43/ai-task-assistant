import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { redis } from "@clients/redis";
import { redlock } from "@clients/redlock";
import { env } from "@config/env";
import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  recordTasksApiFailure,
  recordTasksApiSuccess,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import { getRequestMetadata } from "@services/token-usage-service";
import { createTaskHandler } from "@services/webhooks-service";
import { createLogger } from "@shared/config/create-logger";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { getValidatedQuery } from "@shared/utils/validated-query";
import { CreateTaskWebhookInput } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";
import { reconcileTokensIfPossible } from "@utils/reconcile-tokens-if-possible";

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

      const {
        error: { context },
      } = req.body;

      if (context.type === AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR) {
        recordVagueInput(tasksServiceRequestId);

        void reconcileTokensIfPossible(
          redis,
          redlock,
          tasksServiceRequestId,
          extractOpenaiTokenUsage(context.openaiMetadata),
          env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
        );
      } else {
        // All other errors (OPENAI_API_ERROR, PROMPT_INJECTION_DETECTED, etc.)
        // Reconcile with 0 tokens - no successful OpenAI call
        void reconcileTokensIfPossible(
          redis,
          redlock,
          tasksServiceRequestId,
          0,
          env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
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

    const metadata = await getRequestMetadata(redis, tasksServiceRequestId);

    // Always record success, even if metadata expired
    recordTasksApiSuccess(
      TASKS_OPERATION.CREATE_TASK,
      metadata?.startTime ?? Date.now(),
      tasksServiceRequestId,
    );

    // Reconcile tokens
    void reconcileTokensIfPossible(
      redis,
      redlock,
      tasksServiceRequestId,
      extractOpenaiTokenUsage(openaiMetadata),
      env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
    );
  } catch (error) {
    logger.error("Failed to create task from callback", error, {
      aiServiceRequestId,
      tasksServiceRequestId,
    });

    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, tasksServiceRequestId);

    // Reconcile tokens for internal errors (use 0 tokens - no OpenAI call involved)
    void reconcileTokensIfPossible(
      redis,
      redlock,
      tasksServiceRequestId,
      0,
      env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
    );
  } finally {
    res.sendStatus(StatusCodes.OK);
  }
};
