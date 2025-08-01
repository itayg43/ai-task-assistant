import { NextFunction, Request, Response } from "express";

import { createLogger } from "@config/logger";
import { getAuthenticationContext } from "@utils/authentication-context";
import { getCurrentTime, getElapsedTime } from "@utils/time-date";

const logger = createLogger("requestResponseMetadata");

export const requestResponseMetadata = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const startTimestamp = getCurrentTime();

    const requestMetadata = {
      method: req.method,
      originalUrl: req.originalUrl,
      userAgent: req.get("User-Agent"),
      authenticationContext: !req.originalUrl.includes("/health")
        ? // May throw AuthenticationError
          getAuthenticationContext(res)
        : undefined,
    };

    logger.info("Incoming request", requestMetadata);

    const originalEnd = res.end;
    let completed = false; // Guard: per-request, not shared
    res.end = function (chunk?: any, encoding?: any) {
      if (!completed) {
        completed = true;
        const duration = getElapsedTime(startTimestamp);

        logger.info("Request completed", {
          ...requestMetadata,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
        });
      }
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  } catch (error) {
    // Pass AuthenticationError to error handler
    next(error);
  }
};
