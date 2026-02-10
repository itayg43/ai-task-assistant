import z from "zod";

import { createTaskWebhookInputSchema } from "@schemas";

export type CreateTaskWebhookInput = z.infer<
  typeof createTaskWebhookInputSchema
>;

// Extract error context type from webhook input
type CreateTaskWebhookBody = CreateTaskWebhookInput["body"];
export type TCreateTaskAiErrorContext = Extract<
  CreateTaskWebhookBody,
  { success: false }
>["error"]["context"];
