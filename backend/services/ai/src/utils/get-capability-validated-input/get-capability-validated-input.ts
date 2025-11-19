import { Response } from "express";

export const getCapabilityValidatedInput = (res: Response) => {
  const validatedInput = res.locals.capabilityValidatedInput;

  if (!validatedInput) {
    throw new Error("Capability validated input not defined");
  }

  return validatedInput;
};
