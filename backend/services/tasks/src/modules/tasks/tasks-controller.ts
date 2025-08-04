import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CreateTaskInput } from "@modules/tasks/tasks-schemas";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("tasksController");

export const createTask = async (
  req: Request<{}, unknown, CreateTaskInput["body"]>,
  res: Response
) => {
  logger.info("Create task input", req.body);

  res.sendStatus(StatusCodes.OK);
};
