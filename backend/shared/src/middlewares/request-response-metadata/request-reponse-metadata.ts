import { NextFunction, Request, Response } from "express";

import { createLogger } from "../../config/create-logger";
import { HEALTH_ROUTE } from "../../constants";
import { getAuthenticationContext } from "../../utils/authentication-context";
import { getElapsedDuration } from "../../utils/performance";

export const requestResponseMetadata = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const logger = createLogger("requestResponseMetadata");

    const start = performance.now();

    const requestMetadata = {
      method: req.method,
      originalUrl: req.originalUrl,
      userAgent: req.get("User-Agent"),
      authenticationContext: !req.originalUrl.includes(HEALTH_ROUTE)
        ? getAuthenticationContext(res)
        : undefined,
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
