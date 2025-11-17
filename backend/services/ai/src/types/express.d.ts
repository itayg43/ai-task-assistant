import z from "zod";

import { AnyCapabilityConfig } from "@types";

declare global {
  namespace Express {
    interface Locals {
      capabilityConfig?: AnyCapabilityConfig;
      capabilityValidatedInput?: AnyCapabilityConfig["inputSchema"] extends z.ZodSchema<
        infer T
      >
        ? T
        : never;
      requestId: string;
    }
  }
}
