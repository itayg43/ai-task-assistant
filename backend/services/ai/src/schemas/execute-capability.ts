import z from "zod";

import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";

export const executeCapabilityInputSchema = z.object({
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
