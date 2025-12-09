import { Response } from "express";

export const getValidatedQuery = <T = Record<string, unknown>>(
  res: Response
): T => {
  const query = res.locals.validatedQuery;

  if (!query) {
    throw new Error("Validated query is missing");
  }

  return query as T;
};
