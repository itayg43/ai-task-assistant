import { NextFunction, Request, Response } from "express";

import { openaiUpdateTokenUsage } from "@middlewares/token-usage-rate-limiter";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";

export const tokenUsageErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const tokenUsage = res.locals.tokenUsage;

  if (tokenUsage && tokenUsage.actualTokens === undefined) {
    const errorMetadata = (err as any)?.openaiMetadata;
    const actualTokens =
      errorMetadata && typeof errorMetadata === "object"
        ? extractOpenaiTokenUsage(errorMetadata)
        : 0;

    tokenUsage.actualTokens = actualTokens;
    (tokenUsage as any).updateTriggered = true;

    // Fire-and-forget: run the same update middleware (with lock) without blocking response
    void openaiUpdateTokenUsage(req, res, () => {});
  }

  next(err);
};
