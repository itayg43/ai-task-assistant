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
      if (req.path.includes(HEALTH_ROUTE)) {
        logger.info("Allowing no-origin request to health endpoint:", {
          path: req.path,
          method: req.method,
        });

        next();

        return;
      } else {
        logger.warn("Blocking no-origin request to non-health endpoint:", {
          path: req.path,
          method: req.method,
        });

        next(
          new ForbiddenError(
            "No-origin requests only allowed to health endpoints"
          )
        );

        return;
      }
    }

    if (allowedOrigins.includes(origin)) {
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

    next(new ForbiddenError(`Origin ${origin} not allowed by CORS policy`));
  };
