import { Response } from "express";

import { BadRequestError } from "@shared/errors";
import { CapabilityPattern } from "@types";

export const getCapabilityPattern = (res: Response): CapabilityPattern => {
  const pattern = res.locals.capabilityPattern;

  if (!pattern) {
    throw new BadRequestError("Capability pattern not defined");
  }

  return pattern;
};
