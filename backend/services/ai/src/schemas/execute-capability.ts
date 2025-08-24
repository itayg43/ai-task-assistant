import z from "zod";

import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { baseRequestSchema } from "@shared/schemas";

export const executeCapabilityInputSchema = baseRequestSchema.extend({
  params: z.object({
    capability: z.enum(CAPABILITY, {
      message: "Invalid",
    }),
  }),
  query: z.object({
    pattern: z.enum(CAPABILITY_PATTERN, {
      message: "Invalid",
    }),
  }),
});
