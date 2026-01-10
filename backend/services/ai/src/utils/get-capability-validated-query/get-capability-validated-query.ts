import { Response } from "express";

import { BadRequestError } from "@shared/errors";

export const getCapabilityValidatedQuery = (res: Response) => {
  const query = res.locals.capabilityValidatedQuery;

  if (!query) {
    throw new BadRequestError("Capability validated query not defined");
  }

  return query;
};
