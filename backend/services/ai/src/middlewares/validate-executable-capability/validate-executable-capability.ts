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

    const validatedCapabilityInput = capabilityConfig.inputSchema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    Object.assign(req.body, validatedCapabilityInput.body);
    Object.assign(req.params, validatedCapabilityInput.params);
    Object.assign(req.query, validatedCapabilityInput.query);

    next();
  } catch (error) {
    next(error);
  }
};
