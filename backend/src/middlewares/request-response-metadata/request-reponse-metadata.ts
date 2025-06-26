import { Request, Response, NextFunction } from "express";

import { createLogger } from "@config";
import { TAG } from "@constants";

const logger = createLogger(TAG.REQUEST_RESPONSE_METADATA);

export const requestResponseMetadata = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTimestamp = Date.now();

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
      const duration = Date.now() - startTimestamp;

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
