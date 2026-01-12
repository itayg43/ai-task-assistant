import { NextFunction, Request, Response } from "express";

import { createLogger } from "../../config/create-logger";
import { getAuthenticationContext } from "../../utils/authentication-context";
import { getElapsedDuration, getStartTimestamp } from "../../utils/performance";

const logger = createLogger("requestResponseMetadata");

export const requestResponseMetadata = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const start = getStartTimestamp();

    const requestMetadata = {
      requestId: res.locals.requestId,
      method: req.method,
      originalUrl: req.originalUrl,
      userAgent: req.get("User-Agent"),
      authenticationContext: getAuthenticationContext(res),
    };

    logger.info("Incoming request", requestMetadata);

    const originalEnd = res.end;
    let completed = false; // Guard: per-request, not shared
    res.end = function (chunk?: any, encoding?: any) {
      if (!completed) {
        completed = true;
        const duration = getElapsedDuration(start);

        logger.info("Request completed", {
          ...requestMetadata,
          statusCode: res.statusCode,
          durationMs: duration,
        });
      }
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  } catch (error) {
    next(error);
  }
};
