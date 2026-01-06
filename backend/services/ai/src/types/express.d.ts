import z from "zod";

import { AnyCapabilityConfig, CapabilityPattern } from "@types";

declare global {
  namespace Express {
    interface Locals {
      capabilityConfig?: AnyCapabilityConfig;
      capabilityValidatedInput?: AnyCapabilityConfig["inputSchema"] extends z.ZodSchema<
        infer T
      >
        ? T
        : never;
      capabilityPattern?: CapabilityPattern;
      requestId: string;
    }
  }
}
