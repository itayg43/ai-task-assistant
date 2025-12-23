import { NextFunction, Request, Response } from "express";

import { PARSE_TASK_VAGUE_INPUT_ERROR } from "@constants";
import { openaiUpdateTokenUsage } from "@middlewares/token-usage-rate-limiter";
import { BadRequestError, BaseError } from "@shared/errors";
import { TAiParseTaskVagueInputErrorData } from "@types";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

export const tokenUsageErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const tokenUsage = res.locals.tokenUsage;

  // If no reservation or already reconciled, skip update
  if (!tokenUsage || tokenUsage.actualTokens !== undefined) {
    next(err);

    return;
  }

  if (
    err instanceof BaseError &&
    err.context &&
    err.context.type === PARSE_TASK_VAGUE_INPUT_ERROR
  ) {
    const { message, suggestions, openaiMetadata } =
      err.context as TAiParseTaskVagueInputErrorData;

    tokenUsage.actualTokens = extractOpenaiTokenUsage(openaiMetadata);

    void openaiUpdateTokenUsage(req, res, () => {});

    next(
      new BadRequestError(message, {
        suggestions,
      })
    );

    return;
  }

  // Other errors: release full reservation
  tokenUsage.actualTokens = 0;

  void openaiUpdateTokenUsage(req, res, () => {});

  next(err);
};
