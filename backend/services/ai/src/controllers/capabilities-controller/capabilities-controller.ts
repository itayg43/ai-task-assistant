import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { parseTaskHandler } from "@capabilities/parse-task/parse-task-handler";
import { ParseTaskInput } from "@capabilities/parse-task/parse-task-types";

export const parseTask = async (
  req: Request<
    ParseTaskInput["params"],
    unknown,
    ParseTaskInput["body"],
    ParseTaskInput["query"]
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedTask = await parseTaskHandler({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    res.status(StatusCodes.OK).json(parsedTask);
  } catch (error) {
    next(error);
  }
};
