import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { capabilities } from "@capabilities";
import { createLogger } from "@shared/config/create-logger";
import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { withDurationAsync } from "@shared/utils/with-duration";
import { withRetry } from "@shared/utils/with-retry";
import { ExecuteCapabilityInput } from "@types";

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
  const config = capabilities[capability as keyof typeof capabilities];

  try {
    const validatedCapabilityInput = config.inputSchema.parse(req);

    logger.info("executeCapability - starting", {
      input: validatedCapabilityInput,
    });

    const {
      result: { metadata, result },
      duration,
    } = await withDurationAsync(async () => {
      return await withRetry(DEFAULT_RETRY_CONFIG, () =>
        config.handler(validatedCapabilityInput)
      );
    });

    logger.info("executeCapability - completed", {
      capability,
      metadata,
      result,
      duration: `${duration}ms`,
    });

    res.status(StatusCodes.OK).json({
      metadata,
      result,
    });
  } catch (error) {
    logger.error("executeCapability - failed", error, {
      capability,
    });

    next(error);
  }
};
