import { Response } from "express";

import { InternalError } from "../../errors";

export const getTokenUsageContext = (res: Response) => {
  const tokenUsage = res.locals.tokenUsage;

  if (!tokenUsage) {
    throw new InternalError("Token usage context is missing");
  }

  return tokenUsage;
};
