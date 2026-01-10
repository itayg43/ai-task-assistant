import z from "zod";

import { CAPABILITY_PATTERN } from "@constants";
import { AnyCapabilityConfig } from "@types";
import { executeCapabilityInputSchema } from "@schemas";

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
