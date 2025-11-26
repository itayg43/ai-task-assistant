import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CreateTaskInput } from "@schemas/tasks-schemas";
import { createTaskHandler } from "@services/tasks-service";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("tasksController");

export const createTask = async (
  req: Request<{}, unknown, CreateTaskInput["body"]>,
  res: Response,
  next: NextFunction
) => {
  const { requestId } = res.locals;
  const { naturalLanguage } = req.body;

  const baseLogContext = {
    requestId,
    input: naturalLanguage,
  };

  try {
    logger.info("Create task - starting", baseLogContext);

    const result = await createTaskHandler(requestId, naturalLanguage);

    logger.info("Create task - succeeded", {
      ...baseLogContext,
      result,
    });

    res.status(StatusCodes.CREATED).json({
      tasksServiceRequestId: requestId,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
