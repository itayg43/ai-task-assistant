import { NextFunction, Request, Response } from "express";

import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  recordPromptInjection,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import { openaiUpdateTokenUsage } from "@middlewares/token-usage-rate-limiter";
import { BadRequestError, BaseError } from "@shared/errors";
import { TAiErrorData, TAiParseTaskVagueInputErrorData } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

// Note: Original error with full context is already logged in ai-capabilities-service.ts
export const tasksErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isBaseError = err instanceof BaseError;
  const isBaseErrorWithoutTypeInContext = isBaseError && !err.context?.type;
  if (!isBaseError || isBaseErrorWithoutTypeInContext) {
    next(err);

    return;
  }

  const errorData = err.context as TAiErrorData;
  switch (errorData.type) {
    case AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR: {
      parseTaskVagueInputErrorHandler(req, res, next, errorData);

      break;
    }

    case AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED: {
      recordPromptInjection(TASKS_OPERATION.CREATE_TASK, res.locals.requestId);

      next(new BadRequestError(errorData.message));

      break;
    }

    default: {
      next(err);
    }
  }
};

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

  next(
    new BadRequestError(message, {
      suggestions,
    })
  );
}
