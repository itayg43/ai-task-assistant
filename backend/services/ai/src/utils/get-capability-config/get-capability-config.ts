import { Response } from "express";

export const getCapabilityConfig = (res: Response) => {
  const config = res.locals.capabilityConfig;

  if (!config) {
    throw new Error("Capability config not defined");
  }

  return config;
};
