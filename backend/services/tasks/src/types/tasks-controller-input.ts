import { z } from "zod";

import {
  createTaskInputSchema,
  getTasksInputSchema,
} from "@schemas/tasks-schemas";

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type GetTasksInput = z.infer<typeof getTasksInputSchema>;
