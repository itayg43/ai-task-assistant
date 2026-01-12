import z from "zod";

import { createTaskWebhookInputSchema } from "@schemas";

export type CreateTaskWebhookInput = z.infer<
  typeof createTaskWebhookInputSchema
>;
