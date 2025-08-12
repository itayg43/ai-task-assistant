import z from "zod";

import { CAPABILITY } from "@constants";
import { baseRequestSchema } from "@shared/schemas";

export const executeCapabilityInputSchema = baseRequestSchema.extend({
  params: z.object({
    capability: z.enum(CAPABILITY, {
      message: "Invalid",
    }),
  }),
});
