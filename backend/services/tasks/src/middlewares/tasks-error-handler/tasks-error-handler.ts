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

      next(new BadRequestError(errorData.message));

      break;
    }

    case AI_ERROR_TYPE.RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED: {
      next(
        new ServiceUnavailableError(
          "Unable to process your request at this time. Please try again or contact support."
        )
      );

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
