import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createTaskHandler, getTasksHandler } from "@services/tasks-service";
import { createLogger } from "@shared/config/create-logger";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { getValidatedQuery } from "@shared/utils/validated-query";
import {
  CreateTaskInput,
  CreateTaskResponse,
  GetTasksInput,
  GetTasksResponse,
} from "@types";
import { taskToResponseDto } from "@utils/task-to-response-dto";

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

    const { task, tokensUsed } = await createTaskHandler(
      requestId,
      userId,
      naturalLanguage
    );

    if (res.locals.tokenUsage) {
      res.locals.tokenUsage.actualTokens = tokensUsed;
    }

    logger.info("Create task - succeeded", {
      ...baseLogContext,
      task,
      tokensUsed,
    });

    res.status(StatusCodes.CREATED).json({
      tasksServiceRequestId: requestId,
      task: taskToResponseDto(task),
    });

    // Continue to post-response middleware: "token usage update"
    next();
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
