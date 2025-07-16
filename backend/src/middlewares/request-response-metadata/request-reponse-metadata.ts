import { NextFunction, Request, Response } from "express";

import { createLogger } from "@config/logger";
import { getCurrentTime } from "@utils/time";

const logger = createLogger("requestResponseMetadata");

export const requestResponseMetadata = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTimestamp = getCurrentTime();

  const requestMetadata = {
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
  };
  logger.info("Incoming request", requestMetadata);

  const originalEnd = res.end;
  let completed = false; // Guard: per-request, not shared
  res.end = function (chunk?: any, encoding?: any) {
    if (!completed) {
      completed = true;
      const duration = getCurrentTime() - startTimestamp;

      logger.info("Request completed", {
        ...requestMetadata,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    }
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};
