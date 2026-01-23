import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  recordPromptInjection,
  recordTasksApiFailure,
  recordTasksApiSuccess,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import { createTaskHandler } from "@services/webhooks-service";
import { createLogger } from "@shared/config/create-logger";
import { getAuthenticationContext } from "@shared/utils/authentication-context";
import { CreateTaskWebhookInput } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

const logger = createLogger("webhooksController");

export const createTask = async (
  req: Request<unknown, unknown, CreateTaskWebhookInput["body"]>,
  res: Response,
  _next: NextFunction,
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

      recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, aiServiceRequestId);

      if (
        req.body.error?.context?.type ===
        AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR
      ) {
        recordVagueInput(aiServiceRequestId);
      } else if (
        req.body.error?.context?.type ===
        AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED
      ) {
        recordPromptInjection(TASKS_OPERATION.CREATE_TASK, aiServiceRequestId);
      }
      return;
    }

    const { result } = req.body;
    logger.info("Starting task creation from callback", {
      aiServiceRequestId,
    });

    await createTaskHandler(userId, result.result);
    extractOpenaiTokenUsage(result.openaiMetadata);

    recordTasksApiSuccess(
      TASKS_OPERATION.CREATE_TASK,
      0, // Duration is set to 0 as it's an async callback
      aiServiceRequestId,
    );

    logger.info("Task created successfully from callback", {
      aiServiceRequestId,
    });
  } catch (error) {
    logger.error("Failed to create task from callback", error, {
      aiServiceRequestId,
    });
    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, aiServiceRequestId);
  } finally {
    res.sendStatus(StatusCodes.OK);
  }
};
