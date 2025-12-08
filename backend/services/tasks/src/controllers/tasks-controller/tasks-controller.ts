import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CreateTaskInput, GetTasksInput } from "@schemas/tasks-schemas";
import { createTaskHandler, getTasksHandler } from "@services/tasks-service";
import { createLogger } from "@shared/config/create-logger";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { getValidatedQuery } from "@shared/utils/validated-query";
import { TaskResponse } from "@types";
import { taskToResponseDto } from "@utils/task-to-response-dto";

type BaseTaskControllerResponse = {
  tasksServiceRequestId: string;
};

export type CreateTaskResponse = BaseTaskControllerResponse & {
  task: TaskResponse;
};

export type GetTasksResponse = BaseTaskControllerResponse & {
  tasks: TaskResponse[];
  pagination: {
    totalCount: number;
    skip: number;
    take: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  };
};

const logger = createLogger("tasksController");

export const createTask = async (
  req: Request<{}, unknown, CreateTaskInput["body"]>,
  res: Response<CreateTaskResponse>,
  next: NextFunction
) => {
  const { requestId } = res.locals;
  const { userId } = getAuthenticationContext(res);
  const { naturalLanguage } = req.body;

  const baseLogContext = {
    requestId,
    userId,
    naturalLanguage,
  };

  try {
    logger.info("Create task - starting", baseLogContext);

    const result = await createTaskHandler(requestId, userId, naturalLanguage);

    logger.info("Create task - succeeded", {
      ...baseLogContext,
      result,
    });

    res.status(StatusCodes.CREATED).json({
      tasksServiceRequestId: requestId,
      task: taskToResponseDto(result),
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

    const { skip, take, orderBy, orderDirection, category, priorityLevel } =
      query;

    const result = await getTasksHandler(userId, {
      skip,
      take,
      orderBy,
      orderDirection,
      where: {
        category,
        priorityLevel,
      },
    });

    const response: GetTasksResponse = {
      tasksServiceRequestId: requestId,
      tasks: result.tasks.map(taskToResponseDto),
      pagination: {
        totalCount: result.totalCount,
        skip,
        take,
        hasMore: result.hasMore,
        currentPage: Math.floor(skip / take) + 1,
        totalPages:
          result.totalCount > 0 ? Math.ceil(result.totalCount / take) : 0,
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
