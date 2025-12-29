import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CreateMetricsMiddlewareOptions } from "../../types";
import { getElapsedDuration, getStartTimestamp } from "../../utils/performance";

export const createMetricsMiddleware = (
  options: CreateMetricsMiddlewareOptions
) => {
  const { recorder } = options;

  // Normalize to a resolver function for unified handling
  const resolveOperation: (req: Request, res: Response) => string | null =
    "getOperation" in options
      ? options.getOperation
      : (req) => options.operationsMap[req.method] ?? null;

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = getStartTimestamp();

    res.on("finish", () => {
      // Resolve operation at finish time (after all middleware have run)
      const operation = resolveOperation(req, res);

      if (!operation) {
        // Skip metrics if no operation could be resolved
        return;
      }

      const durationMs = getElapsedDuration(startTime); // Uses performance.now() for accuracy
      const requestId = res.locals.requestId || "";
      const isSuccess =
        res.statusCode >= StatusCodes.OK &&
        res.statusCode < StatusCodes.BAD_REQUEST;

      if (isSuccess) {
        recorder.recordSuccess(operation, durationMs, requestId);
      } else {
        recorder.recordFailure(operation, requestId);
      }
    });

    next();
  };
};
