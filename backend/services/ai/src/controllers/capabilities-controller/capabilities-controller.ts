import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CAPABILITY_PATTERN } from "@constants";
import { executeAsyncPattern } from "@controllers/capabilities-controller/executors/execute-async-pattern";
import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
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
      query: validatedQuery,
    });

    let result;
    if (validatedQuery.pattern === CAPABILITY_PATTERN.SYNC) {
      result = await executeSyncPattern(requestId, config, validatedInput);
    } else {
      result = await executeAsyncPattern(
        requestId,
        config,
        validatedInput,
        validatedQuery.callbackUrl
      );
    }

    res
      .status(
        validatedQuery.pattern === CAPABILITY_PATTERN.ASYNC
          ? StatusCodes.ACCEPTED
          : StatusCodes.OK
      )
      .json({
        ...result,
        aiServiceRequestId: requestId,
      });
  } catch (error) {
    next(error);
  }
};
