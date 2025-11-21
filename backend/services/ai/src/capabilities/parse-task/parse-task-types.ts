import z from "zod";

import {
  parseTaskInputConfigSchema,
  parseTaskInputSchema,
  parseTaskOutputCoreSchema,
  parseTaskOutputJudgeSchema,
  parseTaskOutputSchema,
} from "@capabilities/parse-task/parse-task-schemas";

export type ParseTaskInputConfig = z.infer<typeof parseTaskInputConfigSchema>;

export type ParseTaskInput = z.infer<typeof parseTaskInputSchema>;

export type ParseTaskOutputCore = z.infer<typeof parseTaskOutputCoreSchema>;

export type ParseTaskOutput = z.infer<typeof parseTaskOutputSchema>;

export type ParseTaskOutputJudge = z.infer<typeof parseTaskOutputJudgeSchema>;
