import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createLogger } from "@config/logger";
import { BaseError } from "@errors";
import { ErrorResponse } from "@types";

const logger = createLogger("errorHandler");

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
) => {
  logger.error(error.message, error);

  const status =
    error instanceof BaseError
      ? error.statusCode
      : StatusCodes.INTERNAL_SERVER_ERROR;

  res.status(status).json({
    message: error.message,
  });
};
