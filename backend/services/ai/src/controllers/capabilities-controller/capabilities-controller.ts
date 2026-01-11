import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { executeAsyncPattern } from "@controllers/capabilities-controller/executors/execute-async-pattern";
import { getCapabilityConfig } from "@utils/get-capability-config";
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";
import { getCapabilityValidatedQuery } from "@utils/get-capability-validated-query";

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

    const message = await executeAsyncPattern(
      requestId,
      config,
      validatedInput,
      validatedQuery.callbackUrl
    );

    res.status(StatusCodes.ACCEPTED).json({
      message,
      aiServiceRequestId: requestId,
    });
  } catch (error) {
    next(error);
  }
};
