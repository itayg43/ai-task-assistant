import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { getPatternExecutor } from "@controllers/capabilities-controller/executors/get-pattern-executor";
import { createLogger } from "@shared/config/create-logger";
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
  const requestId = res.locals.requestId;

  try {
    logger.info("executeCapability - starting", {
      requestId,
      capability,
      pattern,
      input: req.body,
    });

    const config = getCapabilityConfig(res);
    const patternExecutor = getPatternExecutor(pattern);

    const executeCapabilityInput: ExecuteCapabilityInput = {
      body: req.body as Record<string, unknown>,
      params: req.params,
      query: req.query,
    };

    const executorResult = await patternExecutor(
      config,
      executeCapabilityInput,
      requestId
    );

    logger.info("executeCapability - succeeded", {
      requestId,
      capability,
      pattern,
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
