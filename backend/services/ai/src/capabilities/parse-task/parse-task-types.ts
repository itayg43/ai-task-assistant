import * as z from "zod";

import {
  parseTaskConfigSchema,
  parseTaskInputSchema,
  parseTaskOutputSchema,
} from "@capabilities/parse-task/parse-task-schemas";

export type ParseTaskConfig = z.infer<typeof parseTaskConfigSchema>;

export type ParseTaskInput = z.infer<typeof parseTaskInputSchema>;

export type ParseTaskOutput = z.infer<typeof parseTaskOutputSchema>;
