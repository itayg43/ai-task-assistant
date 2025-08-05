import * as z from "zod";

import {
  parseTaskInputSchema,
  parseTaskOutputSchema,
} from "@capabilities/parse-task/parse-task-schemas";

export type ParseTaskInput = z.infer<typeof parseTaskInputSchema>;

export type ParseTaskOutput = z.infer<typeof parseTaskOutputSchema>;
