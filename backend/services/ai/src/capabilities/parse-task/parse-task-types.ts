import * as z from "zod";

import {
  parseTaskConfigPrioritiesScoreRangeSchema,
  parseTaskConfigPrioritiesScoresSchema,
  parseTaskConfigSchema,
  parseTaskInputSchema,
  parseTaskOutputSchema,
} from "@capabilities/parse-task/parse-task-schemas";

export type ParseTaskConfigPrioritiesScoreRange = z.infer<
  typeof parseTaskConfigPrioritiesScoreRangeSchema
>;

export type ParseTaskConfigPrioritiesScores = z.infer<
  typeof parseTaskConfigPrioritiesScoresSchema
>;

export type ParseTaskConfig = z.infer<typeof parseTaskConfigSchema>;

export type ParseTaskInput = z.infer<typeof parseTaskInputSchema>;

export type ParseTaskOutput = z.infer<typeof parseTaskOutputSchema>;
