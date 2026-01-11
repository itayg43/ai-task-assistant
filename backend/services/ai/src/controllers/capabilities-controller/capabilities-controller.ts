import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { sendMessageToRabbitMQQueue } from "@clients/rabbitmq";
import { RABBITMQ_QUEUE } from "@constants";
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
    const input = getCapabilityValidatedInput(res);
    const { callbackUrl } = getCapabilityValidatedQuery(res);

    await sendMessageToRabbitMQQueue(RABBITMQ_QUEUE.CAPABILITIES, {
      requestId,
      capability: config.name,
      input,
      callbackUrl,
    });

    res.status(StatusCodes.ACCEPTED).json({
      message: "The request has been received and will be executed shortly.",
      aiServiceRequestId: requestId,
    });
  } catch (error) {
    next(error);
  }
};
