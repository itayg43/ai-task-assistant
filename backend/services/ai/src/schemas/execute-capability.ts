import z from "zod";

import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { baseRequestSchema } from "@shared/schemas";

export const executeCapabilityInputSchema = baseRequestSchema.extend({
  params: z.object({
    capability: z.nativeEnum(CAPABILITY, {
      message: "Invalid",
    }),
  }),
  query: z.discriminatedUnion(
    "pattern",
    [
      z.object({
        pattern: z.literal(CAPABILITY_PATTERN.SYNC),
      }),
      z.object({
        pattern: z.literal(CAPABILITY_PATTERN.ASYNC),
        callbackUrl: z.string().url(),
      }),
    ],
    {
      message: "Invalid",
    }
  ),
});
