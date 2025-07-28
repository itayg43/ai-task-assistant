import * as z from "zod";

import {
  createTaskAiResponseSchema,
  createTaskInputSchema,
} from "@modules/tasks/tasks-schemas";

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export type CreateTaskAiResponse = z.infer<typeof createTaskAiResponseSchema>;
