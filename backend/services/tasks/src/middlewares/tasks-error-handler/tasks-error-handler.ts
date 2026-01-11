import { NextFunction, Request, Response } from "express";

import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  recordPromptInjection,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import { openaiUpdateTokenUsage } from "@middlewares/token-usage-rate-limiter";
import { BadRequestError, ServiceUnavailableError } from "@shared/errors";
import { extractErrorInfo } from "@shared/utils/extract-error-info";
import { TAiErrorData, TAiParseTaskVagueInputErrorData } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

export const tasksErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { context } = extractErrorInfo(err);

  if (!context?.type) {
    next(err);

    return;
  }

  const errorData = context as TAiErrorData;
  switch (errorData.type) {
    case AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR: {
      parseTaskVagueInputErrorHandler(req, res, next, errorData);

      break;
    }

    case AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED: {
      recordPromptInjection(TASKS_OPERATION.CREATE_TASK, res.locals.requestId);

      // Sanitize error: remove all context to prevent information leakage
      // about detection mechanisms
      next(new BadRequestError(errorData.message));

      break;
    }

    case AI_ERROR_TYPE.RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED: {
      next(new ServiceUnavailableError(errorData.message));

      break;
    }

    default: {
      next(err);
    }
  }
};

/**
 * Handles vague input errors by recording metrics, reconciling token usage,
 * and sanitizing the error before passing to the next handler.
 *
 * Records the vague input metric, extracts actual token usage from OpenAI metadata
 * if available, reconciles the token usage reservation, and creates a sanitized
 * error response containing only user-facing suggestions.
 *
 * @param req - Express request object
 * @param res - Express response object (must have requestId and optional tokenUsage in locals)
 * @param next - Express next function to pass sanitized error to next handler
 * @param errorData - Vague input error data containing message, suggestions, and optional openaiMetadata
 */
function parseTaskVagueInputErrorHandler(
  req: Request,
  res: Response,
  next: NextFunction,
  errorData: TAiParseTaskVagueInputErrorData
) {
  const { requestId, tokenUsage } = res.locals;

  recordVagueInput(requestId);

  const { message, suggestions, openaiMetadata } = errorData;

  // Reconcile token usage reservation with actual tokens used
  const isOpenaiMetadataValid =
    openaiMetadata && Object.keys(openaiMetadata).length > 0;
  if (tokenUsage && isOpenaiMetadataValid) {
    tokenUsage.actualTokens = extractOpenaiTokenUsage(openaiMetadata);

    void openaiUpdateTokenUsage(req, res, () => {});
  }

  // Sanitize error: remove openaiMetadata and other internal details,
  // keep only user-facing suggestions for vague input errors
  next(
    new BadRequestError(message, {
      suggestions,
    })
  );
}
