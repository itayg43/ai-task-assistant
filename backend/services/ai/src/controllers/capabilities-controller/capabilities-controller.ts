import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { getPatternExecutor } from "@controllers/capabilities-controller/executors/get-pattern-executor";
import { createLogger } from "@shared/config/create-logger";
import { getCapabilityConfig } from "@utils/get-capability-config";
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
    const validatedInput = getCapabilityValidatedInput(res);

    const {
      params: { capability },
      query: { pattern },
    } = validatedInput;

    logger.info("executeCapability - starting", {
      requestId,
      validatedInput,
    });

    const patternExecutor = getPatternExecutor(pattern);
    const executorResult = await patternExecutor(
      config,
      validatedInput,
      requestId
    );

    logger.info("executeCapability - succeeded", {
      requestId,
      capability,
      result: executorResult.result,
      totalDurationMs: executorResult.durationMs,
    });

    res.status(StatusCodes.OK).json({
      ...executorResult.result,
      aiServiceRequestId: requestId,
    });
  } catch (error) {
    next(error);
  }
};
