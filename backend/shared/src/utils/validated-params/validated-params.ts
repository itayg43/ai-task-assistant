import { Response } from "express";

export const getValidatedParams = <T = Record<string, unknown>>(
  res: Response
): T => {
  const params = res.locals.validatedParams;

  if (!params) {
    throw new Error("Validated params is missing");
  }

  return params as T;
};
