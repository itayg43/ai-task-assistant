import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { redis } from "@clients/redis";
import { recordMetadataNotFound } from "@metrics/tasks-metrics";
import { getRequestMetadata } from "@services/token-usage-service";
import {
  createTaskFailureCallbackHandler,
  createTaskSuccessCallbackHandler,
} from "@services/webhooks-service";
import { createLogger } from "@shared/config/create-logger";
import { getValidatedQuery } from "@shared/utils/validated-query";
import type { CreateTaskWebhookInput } from "@types";

const logger = createLogger("webhooksController");

export const createTask = async (
  req: Request<unknown, unknown, CreateTaskWebhookInput["body"]>,
  res: Response,
  _next: NextFunction,
) => {
  const { aiServiceRequestId, success } = req.body;
  const { tasksServiceRequestId } =
    getValidatedQuery<CreateTaskWebhookInput["query"]>(res);

  const requestIds = {
    aiServiceRequestId,
    tasksServiceRequestId,
  };

  const metadata = await getRequestMetadata(redis, tasksServiceRequestId);

  if (!metadata) {
    logger.warn("Metadata not found (expired or never existed)", requestIds);
    recordMetadataNotFound(tasksServiceRequestId);
    res.sendStatus(StatusCodes.OK);
    return;
  }

  if (!success) {
    const { error } = req.body;

    createTaskFailureCallbackHandler(requestIds, metadata, error);
    res.sendStatus(StatusCodes.OK);
    return;
  }

  const { result } = req.body;

  void createTaskSuccessCallbackHandler(requestIds, metadata, result);

  res.sendStatus(StatusCodes.OK);
};
