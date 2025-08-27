import z from "zod";

import { createCapabilityResponseSchema } from "../schemas/create-capability-response";

export type CapabilityResponse<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof createCapabilityResponseSchema<T>>
>;
