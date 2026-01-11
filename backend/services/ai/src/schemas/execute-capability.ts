import z from "zod";

import { CAPABILITY } from "@constants";

export const executeCapabilityInputSchema = z.object({
  params: z.object({
    capability: z.nativeEnum(CAPABILITY),
  }),
  query: z.object({
    callbackUrl: z.string().url(),
  }),
});
