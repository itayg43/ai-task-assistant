import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CreateTaskInput } from "@modules/tasks/tasks-schemas";

export const createTask = async (
  _req: Request<{}, unknown, CreateTaskInput["body"]>,
  res: Response
) => {
  res.sendStatus(StatusCodes.OK);
};
