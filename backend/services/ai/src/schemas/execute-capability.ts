import z from "zod";

import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { baseRequestSchema } from "@shared/schemas";

export const executeCapabilityInputSchema = baseRequestSchema.extend({
  params: z.object({
    capability: z.nativeEnum(CAPABILITY, {
      message: "Invalid",
    }),
  }),
  query: z.discriminatedUnion("pattern", [
    z.object({
      pattern: z.literal(CAPABILITY_PATTERN.SYNC),
    }),
    z.object({
      pattern: z.literal(CAPABILITY_PATTERN.ASYNC),
      callbackUrl: z.string().url(),
      userId: z.coerce.number().int().positive(),
      tokenReservation: z.string().transform((str, ctx) => {
        // Accept JSON as string and parse it
        try {
          return z
            .object({
              tokensReserved: z.coerce.number(),
              windowStartTimestamp: z.coerce.number(),
            })
            .parse(JSON.parse(str));
        } catch (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid",
          });

          return z.NEVER;
        }
      }),
    }),
  ]),
});
