import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createLogger } from "@shared/config/create-logger";
import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { withDurationAsync } from "@shared/utils/with-duration";
import { withRetry } from "@shared/utils/with-retry";
import { ExecuteCapabilityInput } from "@types";
import { getCapabilityConfig } from "@utils/get-capability-config";

const logger = createLogger("capabilitiesController");

export const executeCapability = async (
  req: Request<
    ExecuteCapabilityInput["params"],
    unknown,
    unknown,
    ExecuteCapabilityInput["query"]
  >,
  res: Response,
  next: NextFunction
) => {
  const { capability } = req.params;
  const { pattern } = req.query;

  try {
    logger.info("executeCapability - starting", {
      capability,
      pattern,
      input: req.body,
    });

    const config = getCapabilityConfig(res);

    const { result, duration } = await withDurationAsync(async () => {
      return await withRetry(DEFAULT_RETRY_CONFIG, () =>
        config.handler({
          body: req.body,
          params: req.params,
          query: req.query,
        })
      );
    });

    logger.info("executeCapability - completed", {
      capability,
      pattern,
      result,
      totalDuration: `${duration}ms`,
    });

    res.status(StatusCodes.OK).json(result);
  } catch (error) {
    logger.error("executeCapability - failed", error, {
      capability,
      pattern,
      input: req.body,
    });

    next(error);
  }
};
