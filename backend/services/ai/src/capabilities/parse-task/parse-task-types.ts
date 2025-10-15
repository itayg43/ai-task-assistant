import z from "zod";

import {
  parseTaskConfigSchema,
  parseTaskInputSchema,
} from "@capabilities/parse-task/parse-task-schemas";

export type ParseTaskConfig = z.infer<typeof parseTaskConfigSchema>;

export type ParseTaskInput = z.infer<typeof parseTaskInputSchema>;
