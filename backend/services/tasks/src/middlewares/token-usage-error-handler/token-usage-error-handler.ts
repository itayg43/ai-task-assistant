import { NextFunction, Request, Response } from "express";

import { openaiUpdateTokenUsage } from "@middlewares/token-usage-rate-limiter";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("tokenUsageErrorHandler");

export const tokenUsageErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const tokenUsage = res.locals.tokenUsage;

  // If no reservation or already reconciled, skip update
  if (!tokenUsage || tokenUsage.actualTokens !== undefined) {
    logger.debug("Token usage reconciliation skipped", {
      requestId: res.locals.requestId,
      tokenUsage,
    });

    next(err);

    return;
  }

  // Other errors: release full reservation
  tokenUsage.actualTokens = 0;

  void openaiUpdateTokenUsage(req, res, () => {});

  next(err);
};
