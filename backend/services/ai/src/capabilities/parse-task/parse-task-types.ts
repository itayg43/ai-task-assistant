import * as z from "zod";

import {
  parseTaskConfigPrioritiesOverallScoreRange,
  parseTaskConfigSchema,
  parseTaskInputSchema,
  parseTaskOutputSchema,
} from "@capabilities/parse-task/parse-task-schemas";

export type ParseTaskConfigPrioritiesOverallScoreRange = z.infer<
  typeof parseTaskConfigPrioritiesOverallScoreRange
>;

export type ParseTaskConfig = z.infer<typeof parseTaskConfigSchema>;

export type ParseTaskInput = z.infer<typeof parseTaskInputSchema>;

export type ParseTaskOutput = z.infer<typeof parseTaskOutputSchema>;
