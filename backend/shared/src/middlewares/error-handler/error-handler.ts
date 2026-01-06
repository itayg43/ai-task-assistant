import { NextFunction, Request, Response } from "express";

import { createLogger } from "../../config/create-logger";
import { SENSITIVE_FIELDS } from "../../constants/sensitive-fields";
import { extractErrorInfo } from "../../utils/extract-error-info";

const logger = createLogger("errorHandler");

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
