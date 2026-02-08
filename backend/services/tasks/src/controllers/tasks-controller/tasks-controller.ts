import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { redis } from "@clients/redis";
import { env } from "@config/env";
import { TASKS_OPERATION } from "@constants";
import {
  recordTasksApiFailure,
  recordTasksApiSuccess,
} from "@metrics/tasks-metrics";
import { createTaskHandler, getTasksHandler } from "@services/tasks-service";
import { storeRequestMetadata } from "@services/token-usage-service";
import { createLogger } from "@shared/config/create-logger";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { getValidatedQuery } from "@shared/utils/validated-query";
import { withMetrics } from "@shared/utils/with-metrics";
import {
  CreateTaskRequestInput,
  CreateTaskResponse,
  GetTasksInput,
  GetTasksResponse,
} from "@types";
import { taskToResponseDto } from "@utils/task-to-response-dto";

const logger = createLogger("tasksController");

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

    // Background: Store request metadata for later reconciliation (non-blocking)
    // Note: storeRequestMetadata has internal error handling and never throws
    if (res.locals.tokenUsage) {
      const { userId } = getAuthenticationContext(res);
      void storeRequestMetadata(redis, requestId, {
        userId,
        tokensReserved: res.locals.tokenUsage.tokensReserved,
        windowStartTimestamp: res.locals.tokenUsage.windowStartTimestamp,
        startTime,
        serviceName: env.SERVICE_NAME,
        rateLimiterName: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_NAME,
      });
    }
  } catch (error) {
    next(error);
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
        const query = getValidatedQuery<GetTasksInput["query"]>(res);

        const { tasks, totalCount, hasMore, currentPage, totalPages } =
          await getTasksHandler(userId, {
            skip: query.skip,
            take: query.take,
            orderBy: query.orderBy,
            orderDirection: query.orderDirection,
            where: {
              category: query.category,
              priorityLevel: query.priorityLevel,
            },
          });

        res.status(StatusCodes.OK).json({
          tasksServiceRequestId: requestId,
          tasks: tasks.map(taskToResponseDto),
          pagination: {
            totalCount,
            skip: query.skip,
            take: query.take,
            hasMore,
            currentPage,
            totalPages,
          },
        });
      },
    );
  } catch (error) {
    next(error);
  }
};
