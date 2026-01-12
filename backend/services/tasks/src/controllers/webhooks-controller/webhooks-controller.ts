import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { createTaskHandler } from "@services/webhooks-service";
import { createLogger } from "@shared/config/create-logger";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { CreateTaskWebhookInput } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

const logger = createLogger("webhooksController");

export const createTask = async (
  req: Request<unknown, unknown, CreateTaskWebhookInput["body"]>,
  res: Response,
  _next: NextFunction
) => {
  const { userId } = getAuthenticationContext(res);
  const { aiServiceRequestId, success } = req.body;

  try {
    if (!success) {
      // Domain-specific error handlers (after routes, before global error handler)
      // Order matters: tasksErrorHandler must run before tokenUsageErrorHandler
      // because tasksErrorHandler handles specific error types and may reconcile
      // token usage, while tokenUsageErrorHandler handles ALL remaining errors
      // and releases full reservation for unexpected failures
      // webhooksRouter.use(tasksErrorHandler);

      return;
    }

    const { result } = req.body;
    const createdTask = await createTaskHandler(userId, result.result);
    const tokenUsage = extractOpenaiTokenUsage(result.openaiMetadata);
  } catch (error) {
    logger.error("Failed to create task", error, {
      aiServiceRequestId,
    });
  } finally {
    res.sendStatus(StatusCodes.OK);
  }
};
