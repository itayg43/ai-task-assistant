import { z } from "zod";

import { createTaskRequestInputSchema, getTasksInputSchema } from "@schemas";

export type CreateTaskRequestInput = z.infer<
  typeof createTaskRequestInputSchema
>;
export type GetTasksInput = z.infer<typeof getTasksInputSchema>;
