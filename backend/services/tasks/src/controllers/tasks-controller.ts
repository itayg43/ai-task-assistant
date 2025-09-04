import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CreateTaskInput } from "@schemas/tasks-schemas";
import { createTaskHandler } from "@services/tasks-service";
import { DEFAULT_PARSE_TASK_CONFIG } from "@constants";

export const createTask = async (
  req: Request<{}, unknown, CreateTaskInput["body"]>,
  res: Response,
  next: NextFunction
) => {
  const { naturalLanguage } = req.body;

  try {
    const result = await createTaskHandler(
      naturalLanguage,
      DEFAULT_PARSE_TASK_CONFIG
    );

    res.status(StatusCodes.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};
