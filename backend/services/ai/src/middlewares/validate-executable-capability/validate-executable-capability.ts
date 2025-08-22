import { NextFunction, Request, Response } from "express";

import { capabilities } from "@capabilities";
import { executeCapabilityInputSchema } from "@schemas";
import { NotFoundError } from "@shared/errors";

export const validateExecutableCapability = async (
  req: Request,
  _res: Response,
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

    next();
  } catch (error) {
    next(error);
  }
};
