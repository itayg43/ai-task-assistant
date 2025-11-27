import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";

import { isHttpError } from "../../clients/http";
import { createLogger } from "../../config/create-logger";
import { DEFAULT_ERROR_MESSAGE } from "../../constants";
import { SENSITIVE_FIELDS } from "../../constants/sensitive-fields";
import { BaseError } from "../../errors";
import { HttpErrorResponseData } from "../../types";

const logger = createLogger("errorHandler");

const DEFAULT_ERROR_STATUS = StatusCodes.INTERNAL_SERVER_ERROR;
export const ZOD_SCHEMA_VALIDATION_ERROR =
  "ZOD_SCHEMA_VALIDATION_ERROR" as const;

export const createErrorHandler = (serviceName: string) => {
  return (
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

    const finalContext = {
      ...safeContext,
      [`${serviceName}ServiceRequestId`]: res.locals.requestId,
    };

    logger.error(message, error, finalContext);

    res.status(status).json({
      message,
      ...finalContext,
    });
  };
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
      context: {
        type: ZOD_SCHEMA_VALIDATION_ERROR,
      },
    };
  }

  if (isHttpError(error)) {
    const responseData = error.response?.data as HttpErrorResponseData;

    return {
      status: error.response?.status || DEFAULT_ERROR_STATUS,
      message: responseData?.message || DEFAULT_ERROR_MESSAGE,
      context: responseData,
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
