import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { parseTask } from "@modules/tasks/tasks-ai-service";
import { CreateTaskInput } from "@modules/tasks/tasks-types";

export const createTask = async (
  req: Request<{}, unknown, CreateTaskInput["body"]>,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedTask = await parseTask(req.body.naturalLanguage);

    res.status(StatusCodes.OK).json(parsedTask);
  } catch (error) {
    next(error);
  }
};
