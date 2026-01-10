import z from "zod";

import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";

export const executeCapabilityInputSchema = z.object({
  params: z.object({
    capability: z.nativeEnum(CAPABILITY, {
      message: "Invalid",
    }),
  }),
  query: z.discriminatedUnion(
    "pattern",
    [
      z.object({
        pattern: z.literal(CAPABILITY_PATTERN.ASYNC),
        callbackUrl: z.string().url(),
      }),
      z.object({
        pattern: z.literal(CAPABILITY_PATTERN.SYNC),
      }),
    ],
    {
      message: "Invalid",
    }
  ),
});
