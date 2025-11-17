import { Response } from "express";

import { AnyCapabilityConfig } from "@types";

export const getCapabilityConfig = (res: Response): AnyCapabilityConfig => {
  const config = res.locals.capabilityConfig;

  if (!config) {
    throw new Error("Capability config not defined");
  }

  return config;
};
