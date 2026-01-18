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

  logger.info("Received callback from AI service", {
    aiServiceRequestId,
    success,
  });

  try {
    if (!success) {
      logger.warn("Callback indicates failure, skipping task creation", {
        requestId: aiServiceRequestId,
        error: req.body.error,
      });
      return;
    }

    const { result } = req.body;
    logger.info("Starting task creation from callback", {
      aiServiceRequestId,
    });

    const createdTask = await createTaskHandler(userId, result.result);
    const tokenUsage = extractOpenaiTokenUsage(result.openaiMetadata);

    logger.info("Task created successfully from callback", {
      aiServiceRequestId,
    });
  } catch (error) {
    logger.error("Failed to create task from callback", error, {
      aiServiceRequestId,
    });
  } finally {
    res.sendStatus(StatusCodes.OK);
  }
};
