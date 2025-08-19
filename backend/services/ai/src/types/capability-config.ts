import z from "zod";

import { Capability } from "@types";

export type CapabilityConfig<TInput, TOutput> = {
  name: Capability;
  handler: (input: TInput) => Promise<TOutput>;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
};
