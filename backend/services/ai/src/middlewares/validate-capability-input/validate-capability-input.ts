import { NextFunction, Request, Response } from "express";

import { getCapabilityConfig } from "@utils/get-capability-config";

export const validateCapabilityInput = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const config = getCapabilityConfig(res);

    const validatedInput = config.inputSchema.parse(req);

    Object.assign(req.body, validatedInput.body);

    next();
  } catch (error) {
    next(error);
  }
};
