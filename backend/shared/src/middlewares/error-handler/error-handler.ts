import { AxiosError } from "axios";
import { NextFunction, Request, Response } from "express";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import { ZodError } from "zod";

import { createLogger } from "../../config/create-logger";
import { SENSITIVE_FIELDS } from "../../constants/sensitive-fields";
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
  const { status, message, context } = extractErrorInfo(error);

  const safeContext = context
    ? Object.fromEntries(
        Object.entries(context).filter(
          ([key]) => !SENSITIVE_FIELDS.includes(key)
        )
      )
    : {};

  logger.error(message, error, safeContext);

  res.status(status).json({
    message,
    ...safeContext,
  });
};

function extractErrorInfo(error: unknown) {
  if (error instanceof BaseError) {
    return {
      status: error.statusCode,
      message: error.message,
      context: error.context,
    };
  }

  if (error instanceof ZodError) {
    return {
      status: StatusCodes.BAD_REQUEST,
      message: formatZodErrors(error),
    };
  }

  if (error instanceof AxiosError) {
    return {
      status: error.response?.status || DEFAULT_ERROR_STATUS,
      message: error.response?.data?.message || DEFAULT_ERROR_MESSAGE,
      context: error.response?.data,
    };
  }

  return {
    status: DEFAULT_ERROR_STATUS,
    message: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
  };
}

function formatZodErrors(error: ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
    .join("; ");
}
