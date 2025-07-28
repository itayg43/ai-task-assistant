import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createTaskHandler } from "@modules/tasks/tasks-service";
import { CreateTaskInput } from "@modules/tasks/tasks-types";

export const createTask = async (
  req: Request<{}, unknown, CreateTaskInput["body"]>,
  res: Response,
  next: NextFunction
) => {
  try {
    const createdTask = await createTaskHandler(req.body.naturalLanguage);

    res.status(StatusCodes.CREATED).json(createdTask);
  } catch (error) {
    next(error);
  }
};
