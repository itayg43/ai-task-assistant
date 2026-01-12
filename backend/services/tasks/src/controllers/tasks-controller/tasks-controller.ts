import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createTaskHandler, getTasksHandler } from "@services/tasks-service";
import { createLogger } from "@shared/config/create-logger";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { getValidatedQuery } from "@shared/utils/validated-query";
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
  next: NextFunction
) => {
  const { requestId } = res.locals;
  const { naturalLanguage } = req.body;

  try {
    const message = await createTaskHandler(requestId, naturalLanguage);

    res.status(StatusCodes.ACCEPTED).json({
      message,
      tasksServiceRequestId: requestId,
    });
  } catch (error) {
    next(error);
  }
};

export const getTasks = async (
  _req: Request<{}, unknown, unknown, GetTasksInput["query"]>,
  res: Response<GetTasksResponse>,
  next: NextFunction
) => {
  const { requestId } = res.locals;
  const { userId } = getAuthenticationContext(res);
  const query = getValidatedQuery<GetTasksInput["query"]>(res);

  const baseLogContext = {
    requestId,
    userId,
    query,
  };

  try {
    logger.info("Get tasks - starting", baseLogContext);

    const result = await getTasksHandler(userId, {
      skip: query.skip,
      take: query.take,
      orderBy: query.orderBy,
      orderDirection: query.orderDirection,
      where: {
        category: query.category,
        priorityLevel: query.priorityLevel,
      },
    });

    const response: GetTasksResponse = {
      tasksServiceRequestId: requestId,
      tasks: result.tasks.map(taskToResponseDto),
      pagination: {
        totalCount: result.totalCount,
        skip: query.skip,
        take: query.take,
        hasMore: result.hasMore,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      },
    };

    logger.info("Get tasks - succeeded", {
      ...baseLogContext,
      result: response,
    });

    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};
