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
} from "@metrics/tasks-metrics";
import { createTaskHandler, getTasksHandler } from "@services/tasks-service";
import {
  reconcileTokenUsage,
  storeRequestMetadata,
} from "@services/token-usage-service";
import { BaseError } from "@shared/errors";
import type { RequestMetadata } from "@shared/types";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { extractErrorInfo } from "@shared/utils/extract-error-info";
import { getValidatedQuery } from "@shared/utils/validated-query";
import { withMetrics } from "@shared/utils/with-metrics";
import {
  CreateTaskRequestInput,
  CreateTaskResponse,
  GetTasksInput,
  GetTasksResponse,
} from "@types";
import { taskToResponseDto } from "@utils/task-to-response-dto";

export const createTask = async (
  req: Request<unknown, unknown, CreateTaskRequestInput["body"]>,
  res: Response<CreateTaskResponse>,
  next: NextFunction,
) => {
  const { requestId } = res.locals;
  const { naturalLanguage } = req.body;
  const startTime = Date.now();

  try {
    const message = await createTaskHandler(requestId, naturalLanguage);

    res.status(StatusCodes.ACCEPTED).json({
      message,
      tasksServiceRequestId: requestId,
    });

    if (res.locals.tokenUsage) {
      const { tokensReserved, windowStartTimestamp } = res.locals.tokenUsage;
      const { userId } = getAuthenticationContext(res);
      void storeRequestMetadata(redis, requestId, {
        userId,
        tokensReserved,
        windowStartTimestamp,
        startTime,
        serviceName: env.SERVICE_NAME,
        rateLimiterName: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_NAME,
      });
    }
  } catch (error) {
    // Extract error info to access internal context (type, etc.)
    const errorInfo = extractErrorInfo(error);

    // Record general failure metric
    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, requestId);

    // Handle specific error types with additional metrics
    if (errorInfo.context?.type === AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED) {
      recordPromptInjection(TASKS_OPERATION.CREATE_TASK, requestId);
    }

    // Reconcile tokens for request-path errors (use 0 tokens - no OpenAI call completed)
    if (res.locals.tokenUsage) {
      const { userId } = getAuthenticationContext(res);
      const { tokensReserved, windowStartTimestamp } = res.locals.tokenUsage;

      const metadata: RequestMetadata = {
        userId,
        tokensReserved,
        windowStartTimestamp,
        startTime,
        serviceName: env.SERVICE_NAME,
        rateLimiterName: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_NAME,
      };

      void reconcileTokenUsage(
        redis,
        redlock,
        requestId,
        metadata,
        0, // Request-path error - no tokens consumed
        env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
      );
    }

    // Pass sanitized error to error handler (no internal context like 'type')
    next(new BaseError(errorInfo.message, errorInfo.status));
  }
};

export const getTasks = async (
  _req: Request<{}, unknown, unknown, GetTasksInput["query"]>,
  res: Response<GetTasksResponse>,
  next: NextFunction,
) => {
  const { requestId } = res.locals;

  try {
    await withMetrics(
      {
        operation: TASKS_OPERATION.GET_TASKS,
        requestId,
        onRecordSuccess: recordTasksApiSuccess,
        onRecordFailure: recordTasksApiFailure,
      },
      async () => {
        const { userId } = getAuthenticationContext(res);
        const { skip, take, orderBy, orderDirection, category, priorityLevel } =
          getValidatedQuery<GetTasksInput["query"]>(res);

        const { tasks, pagination } = await getTasksHandler(userId, {
          skip,
          take,
          orderBy,
          orderDirection,
          where: {
            category,
            priorityLevel,
          },
        });

        res.status(StatusCodes.OK).json({
          tasksServiceRequestId: requestId,
          tasks: tasks.map(taskToResponseDto),
          pagination,
        });
      },
    );
  } catch (error) {
    next(error);
  }
};
