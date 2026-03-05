import z from "zod";

import { createTaskWebhookInputSchema } from "@schemas";

export type CreateTaskWebhookInput = z.infer<
  typeof createTaskWebhookInputSchema
>;

type CreateTaskWebhookBody = CreateTaskWebhookInput["body"];

export type CreateTaskWebhookSuccessInput = Extract<
  CreateTaskWebhookBody,
  { success: true }
>;

export type CreateTaskWebhookFailureInput = Extract<
  CreateTaskWebhookBody,
  { success: false }
>;

export type TCreateTaskAiErrorContext =
  CreateTaskWebhookFailureInput["error"]["context"];
