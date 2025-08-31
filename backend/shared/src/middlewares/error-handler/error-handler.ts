import { AxiosError } from "axios";
import { NextFunction, Request, Response } from "express";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import * as z from "zod";

import { createLogger } from "../../config/create-logger";
import { BaseError } from "../../errors";

const logger = createLogger("errorHandler");

const DEFAULT_ERROR_STATUS = StatusCodes.INTERNAL_SERVER_ERROR;
const DEFAULT_ERROR_MESSAGE = getReasonPhrase(
  StatusCodes.INTERNAL_SERVER_ERROR
);

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

  if (error instanceof AxiosError) {
    return {
      status: error.response?.status || DEFAULT_ERROR_STATUS,
      message: error.response?.data?.message || DEFAULT_ERROR_MESSAGE,
    };
  }

  return {
    status: DEFAULT_ERROR_STATUS,
    message: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
  };
}

function formatZodErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
    .join("; ");
}
