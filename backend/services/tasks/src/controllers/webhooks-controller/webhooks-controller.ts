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

  // Fetch metadata once at the top
  const metadata = await getRequestMetadata(redis, tasksServiceRequestId);

  // NOTE: Metadata has 30s TTL (automatic cleanup via Redis expiration).
  // We rely on TTL rather than manual deletion for:
  // 1. Consistency with other Redis keys (token buckets, locks use TTL-only)
  // 2. Simplicity (no nested fire-and-forget, fewer failure modes)
  // 3. Negligible memory impact (112 bytes × requests in flight = <1KB)
  // Metric 'tasks_metadata_not_found_total' tracks TTL expiration edge cases.
  if (!metadata) {
    logger.warn("Metadata not found (expired or never existed)", {
      tasksServiceRequestId,
      aiServiceRequestId,
    });

    recordMetadataNotFound(tasksServiceRequestId);
  }

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

        // Reconcile with actual tokens from OpenAI
        if (metadata) {
          void reconcileTokenUsage(
            redis,
            redlock,
            metadata,
            extractOpenaiTokenUsage(context.openaiMetadata),
            env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
          );
        }
      } else {
        // All other errors - no successful OpenAI call, use 0 tokens
        if (metadata) {
          void reconcileTokenUsage(
            redis,
            redlock,
            metadata,
            0,
            env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
          );
        }
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

    // Record success (use metadata startTime if available)
    recordTasksApiSuccess(
      TASKS_OPERATION.CREATE_TASK,
      metadata?.startTime ?? Date.now(),
      tasksServiceRequestId,
    );

    // Reconcile tokens with actual usage (TTL handles cleanup)
    if (metadata) {
      void reconcileTokenUsage(
        redis,
        redlock,
        metadata,
        extractOpenaiTokenUsage(openaiMetadata),
        env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
      );
    }
  } catch (error) {
    logger.error("Failed to create task from callback", error, {
      aiServiceRequestId,
      tasksServiceRequestId,
    });

    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, tasksServiceRequestId);

    // Internal error - no OpenAI call involved, use 0 tokens
    if (metadata) {
      void reconcileTokenUsage(
        redis,
        redlock,
        metadata,
        0,
        env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
      );
    }
  } finally {
    res.sendStatus(StatusCodes.OK);
  }
};
