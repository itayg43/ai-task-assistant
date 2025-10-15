import z from "zod";

import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { baseRequestSchema } from "@shared/schemas";

export const executeCapabilityInputSchema = baseRequestSchema.extend({
  params: z.object({
    capability: z.nativeEnum(CAPABILITY, {
      message: "Invalid",
    }),
  }),
  query: z.object({
    pattern: z.nativeEnum(CAPABILITY_PATTERN, {
      message: "Invalid",
    }),
  }),
});
