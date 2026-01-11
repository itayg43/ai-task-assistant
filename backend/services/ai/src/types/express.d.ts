import z from "zod";

import { executeCapabilityInputSchema } from "@schemas";
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
      capabilityValidatedQuery?: z.infer<
        typeof executeCapabilityInputSchema
      >["query"];
      requestId: string;
    }
  }
}
