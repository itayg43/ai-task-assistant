import * as z from "zod";

import { executeCapabilityInputSchema } from "@schemas";

export type ExecuteCapabilityInput = z.infer<
  typeof executeCapabilityInputSchema
>;
