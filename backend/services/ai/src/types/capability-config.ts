import z from "zod";

import { Capability, CapabilityPattern } from "@types";

export type CapabilityConfig<TInput, TOutput> = {
  name: Capability;
  pattern: CapabilityPattern;
  handler: (input: TInput) => Promise<TOutput>;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
};
