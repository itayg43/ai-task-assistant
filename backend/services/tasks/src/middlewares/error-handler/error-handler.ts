import { NextFunction, Request, Response } from "express";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import * as z from "zod";

import { createLogger } from "@config/logger";
import { BaseError } from "@errors";

const logger = createLogger("errorHandler");

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const { status, message } = extractErrorInfo(error);

  logger.error(message, error);

  res.status(status).json({
    message,
  });
};

function extractErrorInfo(error: unknown) {
  if (error instanceof BaseError) {
    return {
      status: error.statusCode,
      message: error.message,
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: StatusCodes.BAD_REQUEST,
      message: formatZodErrors(error),
    };
  }

  return {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    message:
      error instanceof Error
        ? error.message
        : getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
  };
}

function formatZodErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
    .join("; ");
}
