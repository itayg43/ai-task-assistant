import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CAPABILITY_PATTERN } from "@constants";
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
    const { requestId } = res.locals;

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
    const { result, durationMs } = await patternExecutor(
      config,
      validatedInput,
      requestId
    );

    logger.info("executeCapability - succeeded", {
      requestId,
      capability,
      result,
      totalDurationMs: durationMs,
    });

    const isSyncPattern = pattern === CAPABILITY_PATTERN.SYNC;
    res.status(isSyncPattern ? StatusCodes.OK : StatusCodes.ACCEPTED).json({
      ...(isSyncPattern && result),
      aiServiceRequestId: requestId,
    });
  } catch (error) {
    next(error);
  }
};
