import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { parseTaskHandler } from "@capabilities/parse-task/parse-task-handler";
import { ParseTaskInput } from "@capabilities/parse-task/parse-task-types";

export const parseTask = async (
  req: Request<{}, unknown, ParseTaskInput["body"]>,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedTask = await parseTaskHandler(req.body.naturalLanguage);

    res.status(StatusCodes.OK).json(parsedTask);
  } catch (error) {
    next(error);
  }
};
