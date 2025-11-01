import { NextFunction, Request, Response } from "express";

import { capabilities } from "@capabilities";
import { executeCapabilityInputSchema } from "@schemas";
import { NotFoundError } from "@shared/errors";

export const validateExecutableCapability = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      params: { capability },
    } = executeCapabilityInputSchema.parse(req);

    const capabilityConfig =
      capabilities[capability as keyof typeof capabilities];

    if (!capabilityConfig) {
      throw new NotFoundError(`Capability ${capability} not found`);
    }

    res.locals.capabilityConfig = capabilityConfig;

    next();
  } catch (error) {
    next(error);
  }
};
