import { NextFunction, Request, Response } from "express";

import { CreateMetricsMiddlewareOptions } from "../../types";
import { getElapsedDuration, getStartTimestamp } from "../../utils/performance";

export const createMetricsMiddleware = (
  options: CreateMetricsMiddlewareOptions
) => {
  const { operationsMap, recorder } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = getStartTimestamp();
    const operation = operationsMap[req.method];

    if (!operation) {
      // Skip metrics for unmapped HTTP methods
      next();

      return;
    }

    res.on("finish", () => {
      const durationMs = getElapsedDuration(startTime); // Uses performance.now() for accuracy
      const requestId = res.locals.requestId || "";
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

      if (isSuccess) {
        recorder.recordSuccess(operation, durationMs, requestId);
      } else {
        recorder.recordFailure(operation, durationMs, requestId);
      }
    });

    next();
  };
};
