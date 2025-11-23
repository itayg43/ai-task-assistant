import z from "zod";

import {
  parseTaskInputConfigSchema,
  parseTaskInputSchema,
  parseTaskOutputCoreSchema,
  parseTaskOutputSchema,
  parseTaskOutputSubtasksSchema,
} from "@capabilities/parse-task/parse-task-schemas";

export type ParseTaskInputConfig = z.infer<typeof parseTaskInputConfigSchema>;

export type ParseTaskInput = z.infer<typeof parseTaskInputSchema>;

export type ParseTaskOutputCore = z.infer<typeof parseTaskOutputCoreSchema>;

export type ParseTaskOutputCoreV2 =
  | {
      success: true;
      task: ParseTaskOutputCore;
      error: null;
    }
  | {
      success: false;
      task: null;
      error: {
        reason: string;
        suggestions: string[];
      };
    };

export type ParseTaskOutputSubtasks = z.infer<
  typeof parseTaskOutputSubtasksSchema
>;

export type ParseTaskOutput = z.infer<typeof parseTaskOutputSchema>;

export type ParseTaskOutputJudge =
  | {
      overallPass: true;
      explanation: null;
      suggestedPromptImprovements: null;
    }
  | {
      overallPass: false;
      explanation: string;
      suggestedPromptImprovements: string[];
    };
