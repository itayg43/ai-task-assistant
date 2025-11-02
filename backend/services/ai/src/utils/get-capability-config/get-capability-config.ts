import { Response } from "express";

import { CapabilityConfig } from "@types";

export const getCapabilityConfig = (
  res: Response
): CapabilityConfig<any, Record<string, unknown>> => {
  const config = res.locals.capabilityConfig;

  if (!config) {
    throw new Error("Capability config not defined");
  }

  return config;
};
