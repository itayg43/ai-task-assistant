import z from "zod";

import { createCapabilityResponseSchema } from "@schemas";

export type CapabilityResponse<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof createCapabilityResponseSchema<T>>
>;
