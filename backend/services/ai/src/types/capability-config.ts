import z from "zod";

import { Capability } from "@types";

export type CapabilityConfig<TInput, TOutput> = {
  name: Capability;
  handler: (input: TInput, requestId: string) => Promise<TOutput>;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  promptInjectionFields: string[];
};
