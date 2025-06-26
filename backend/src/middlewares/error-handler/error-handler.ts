import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

import { createLogger } from "@config";
import { TAG } from "@constants";
import { BaseError } from "@errors";
import { ErrorResponse } from "@types";

const logger = createLogger(TAG.ERROR_HANDLER);

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
) => {
  logger.error(error.message, {
    error,
  });

  const status =
    error instanceof BaseError
      ? error.statusCode
      : StatusCodes.INTERNAL_SERVER_ERROR;

  res.status(status).json({
    message: error.message,
  });
};
