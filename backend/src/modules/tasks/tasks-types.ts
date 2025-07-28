import * as z from "zod";

import { createTaskInputSchema } from "@modules/tasks/tasks-schemas";

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
