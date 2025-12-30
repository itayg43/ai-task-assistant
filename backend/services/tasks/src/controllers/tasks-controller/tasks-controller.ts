import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  recordPromptInjection,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import { openaiUpdateTokenUsage } from "@middlewares/token-usage-rate-limiter";
import { createTaskHandler, getTasksHandler } from "@services/tasks-service";
import { createLogger } from "@shared/config/create-logger";
import { BadRequestError, BaseError } from "@shared/errors";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { getValidatedQuery } from "@shared/utils/validated-query";
import {
  CreateTaskInput,
  CreateTaskResponse,
  GetTasksInput,
  GetTasksResponse,
  TAiParseTaskVagueInputErrorData,
} from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";
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
    // Note: Original error with full context is already logged in ai-capabilities-service.ts
    // Record metrics and prepare sanitized error data for known AI error types
    if (error instanceof BaseError && error.context?.type) {
      const { type } = error.context;
      // Prepare sanitized error data (message and context without internal fields)
      let sanitizedMessage: string | undefined;
      let sanitizedContext: Record<string, unknown> | undefined;

      if (type === AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR) {
        recordVagueInput(requestId);

        const { message, suggestions, openaiMetadata } =
          error.context as TAiParseTaskVagueInputErrorData;

        // Reconcile token usage reservation with actual tokens used
        if (res.locals.tokenUsage && openaiMetadata) {
          res.locals.tokenUsage.actualTokens =
            extractOpenaiTokenUsage(openaiMetadata);

          // Fire-and-forget: don't block error response on token usage update
          void openaiUpdateTokenUsage(req, res, () => {});
        }

        sanitizedMessage = message;
        sanitizedContext = { suggestions };
      } else if (type === AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED) {
        recordPromptInjection(TASKS_OPERATION.CREATE_TASK, requestId);

        sanitizedMessage = error.message;
        sanitizedContext = undefined;
      }

      // Throw sanitized error: strip internal context (type, aiServiceId) before returning to client
      if (sanitizedMessage !== undefined) {
        throw new BadRequestError(sanitizedMessage, sanitizedContext);
      }
    }

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
