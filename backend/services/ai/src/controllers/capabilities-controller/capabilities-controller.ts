import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { capabilities } from "@capabilities";
import { createLogger } from "@shared/config/create-logger";
import { getCurrentTime, getElapsedTime } from "@shared/utils/date-time";
import { withRetry } from "@shared/utils/with-retry";

const logger = createLogger("capabilitiesController");

export const executeCapability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTimestamp = getCurrentTime();

  const { capability } = req.params;
  const config = capabilities[capability as keyof typeof capabilities];

  try {
    logger.info("executeCapability - starting", {
      capability,
      input: {
        body: req.body,
        query: req.query,
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

    const totalDuration = getElapsedTime(startTimestamp);

    logger.info("executeCapability - completed", {
      capability,
      result,
      totalDuration: `${totalDuration}ms`,
    });

    res.status(StatusCodes.OK).json(result);
  } catch (error) {
    logger.error("executeCapability - failed", error, {
      capability,
      input: {
        body: req.body,
        query: req.query,
      },
    });

    next(error);
  }
};
