import { NextFunction, Request, Response } from "express";

import { createLogger } from "../../../config/create-logger";
import { HEALTH_ROUTE } from "../../../constants";
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
  if (isHealthEndpoint(req.path)) {
    logger.info("Allowing no-origin request to health endpoint:", {
      path: req.path,
      method: req.method,
    });

    next();

    return;
  }

  logger.warn("Blocking no-origin request to non-health endpoint:", {
    path: req.path,
    method: req.method,
  });

  const errorMessage = "No-origin requests only allowed to health endpoints";
  next(new ForbiddenError(errorMessage));
}

function handleWithOrigin(
  origin: string,
  allowedOrigins: string[],
  req: Request,
  next: NextFunction
) {
  if (isAllowedOrigin(origin, allowedOrigins)) {
    logger.info("Allowing request from allowed origin:", {
      origin,
      path: req.path,
      method: req.method,
    });

    next();

    return;
  }

  logger.warn("Blocking request from unauthorized origin:", {
    origin,
    path: req.path,
    method: req.method,
  });

  const errorMessage = `Origin ${origin} not allowed by CORS policy`;
  next(new ForbiddenError(errorMessage));
}

function isHealthEndpoint(path: string) {
  return path.includes(HEALTH_ROUTE);
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]) {
  return allowedOrigins.includes(origin);
}
