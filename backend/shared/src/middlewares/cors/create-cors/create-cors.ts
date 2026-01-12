import { NextFunction, Request, Response } from "express";

import { createLogger } from "../../../config/create-logger";
import { HEALTH_ROUTE, METRICS_ROUTE } from "../../../constants";
import { ForbiddenError } from "../../../errors";

const logger = createLogger("cors");

export const createCors =
  (allowedOrigins: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!origin) {
      handleNoOrigin(req, next);
      return;
    }

    handleWithOrigin(origin, allowedOrigins, req, next);
  };

function handleNoOrigin(req: Request, next: NextFunction) {
  const { path, method } = req;

  if (path.includes(HEALTH_ROUTE) || path.includes(METRICS_ROUTE)) {
    next();
    return;
  }

  logger.warn("Blocking no-origin request to non-health/metrics endpoint:", {
    path,
    method,
  });

  next(
    new ForbiddenError(
      "No-origin requests only allowed to health/metrics endpoints"
    )
  );
}

function handleWithOrigin(
  origin: string,
  allowedOrigins: string[],
  req: Request,
  next: NextFunction
) {
  if (allowedOrigins.includes(origin)) {
    next();
    return;
  }

  logger.warn("Blocking request from unauthorized origin:", {
    origin,
    path: req.path,
    method: req.method,
  });

  next(new ForbiddenError(`Origin ${origin} not allowed by CORS policy`));
}
