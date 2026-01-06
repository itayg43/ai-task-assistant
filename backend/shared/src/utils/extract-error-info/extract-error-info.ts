import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";

import { isHttpError } from "../../clients/http";
import {
  DEFAULT_ERROR_MESSAGE,
  ZOD_SCHEMA_VALIDATION_ERROR,
} from "../../constants";
import { BaseError } from "../../errors";
import { ExtractedErrorInfo, HttpErrorResponseData } from "../../types";

const DEFAULT_ERROR_STATUS = StatusCodes.INTERNAL_SERVER_ERROR;

export function extractErrorInfo(error: unknown): ExtractedErrorInfo {
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

export function formatZodErrors(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
    .join("; ");
}

export function isNonRetryableError(
  extractedErrorInfo: ExtractedErrorInfo
): boolean {
  return (
    extractedErrorInfo.status >= StatusCodes.BAD_REQUEST &&
    extractedErrorInfo.status < StatusCodes.INTERNAL_SERVER_ERROR
  );
}
