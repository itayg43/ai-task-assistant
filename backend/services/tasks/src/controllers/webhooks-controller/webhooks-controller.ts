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

  const metadata = await getRequestMetadata(redis, tasksServiceRequestId);

  if (!metadata) {
    logger.warn("Metadata not found (expired or never existed)", {
      tasksServiceRequestId,
      aiServiceRequestId,
    });

    recordMetadataNotFound(tasksServiceRequestId);

    res.sendStatus(StatusCodes.OK);

    return;
  }

  const requestIds = { aiServiceRequestId, tasksServiceRequestId };

  if (!success) {
    const { error } = req.body;

    createTaskFailureCallbackHandler(requestIds, metadata, error);
  } else {
    const {
      result: { result, openaiMetadata },
    } = req.body;

    await createTaskSuccessCallbackHandler(
      requestIds,
      metadata,
      result,
      openaiMetadata,
    );
  }

  res.sendStatus(StatusCodes.OK);
};
