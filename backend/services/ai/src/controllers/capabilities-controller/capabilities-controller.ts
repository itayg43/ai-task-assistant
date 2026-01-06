import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { getPatternExecutor } from "@controllers/capabilities-controller/executors/get-pattern-executor";
import { createLogger } from "@shared/config/create-logger";
import { getCapabilityConfig } from "@utils/get-capability-config";
import { getCapabilityPattern } from "@utils/get-capability-pattern";
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";

const logger = createLogger("capabilitiesController");

export const executeCapability = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const requestId = res.locals.requestId;

    const config = getCapabilityConfig(res);
    const input = getCapabilityValidatedInput(res);
    const pattern = getCapabilityPattern(res);

    logger.info("executeCapability - starting", {
      requestId,
      input,
    });

    const patternExecutor = getPatternExecutor(pattern);
    const result = await patternExecutor(config, input, requestId);

    logger.info("executeCapability - succeeded", {
      requestId,
      capability: config.name,
      result,
    });

    res.status(StatusCodes.OK).json({
      ...result,
      aiServiceRequestId: requestId,
    });
  } catch (error) {
    next(error);
  }
};
