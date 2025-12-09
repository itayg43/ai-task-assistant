import { createTaskSchema, getTasksSchema } from "@schemas/tasks-schemas";
import { z } from "zod";

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type GetTasksInput = z.infer<typeof getTasksSchema>;
