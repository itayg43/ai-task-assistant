import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { getPatternExecutor } from "@controllers/capabilities-controller/executors/get-pattern-executor";
import { createLogger } from "@shared/config/create-logger";
import { getCapabilityConfig } from "@utils/get-capability-config";
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";
import { getCapabilityValidatedQuery } from "@utils/get-capability-validated-query";

const logger = createLogger("capabilitiesController");

export const executeCapability = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const requestId = res.locals.requestId;

    const config = getCapabilityConfig(res);
    const validatedInput = getCapabilityValidatedInput(res);
    const validatedQuery = getCapabilityValidatedQuery(res);

    logger.info("executeCapability - starting", {
      requestId,
      input: validatedInput,
    });

    const patternExecutor = getPatternExecutor(validatedQuery.pattern);
    const result = await patternExecutor(config, validatedInput, requestId);

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
