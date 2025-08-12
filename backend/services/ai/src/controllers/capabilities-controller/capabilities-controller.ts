import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { capabilities } from "@capabilities";
import { createLogger } from "@shared/config/create-logger";
import { getCurrentTime } from "@shared/utils/date-time";
import { withRetry } from "@shared/utils/with-retry";

const logger = createLogger("capabilitiesController");

export const executeCapability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { capability } = req.params;
    const config = capabilities[capability as keyof typeof capabilities];

    const startTimestamp = getCurrentTime();

    logger.info(`${capability} - starting`, {
      capability,
      input: {
        ...req.body,
        ...req.query,
      },
    });

    const result = await withRetry(
      { maxAttempts: 3, baseDelayMs: 1000, backoffMultiplier: 2 },
      () =>
        config.handler({
          body: req.body,
          params: req.params,
          query: req.query,
        })
    );

    const duration = getCurrentTime() - startTimestamp;

    logger.info(`${capability} - completed successfully`, {
      capability,
      duration: `${duration.toFixed(2)}ms`,
      result,
    });

    res.status(StatusCodes.OK).json(result);
  } catch (error) {
    next(error);
  }
};
