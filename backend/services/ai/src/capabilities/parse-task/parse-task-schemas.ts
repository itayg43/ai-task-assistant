import z from "zod";

import { executeCapabilityInputSchema } from "@schemas";

const parseTaskInputConfigPrioritiesScoreRangeSchema = z.object({
  min: z.number().min(0),
  max: z.number().positive(),
});

const parseTaskInputConfigPrioritiesSchema = z.object({
  levels: z.array(z.string().trim().nonempty()),
  scores: z.record(
    z.string().trim().nonempty(),
    parseTaskInputConfigPrioritiesScoreRangeSchema
  ),
  overallScoreRange: parseTaskInputConfigPrioritiesScoreRangeSchema,
});

export const parseTaskInputConfigSchema = z.object({
  categories: z.array(z.string().trim().nonempty()),
  priorities: parseTaskInputConfigPrioritiesSchema,
});

export const parseTaskInputSchema = executeCapabilityInputSchema.extend({
  body: z.object({
    naturalLanguage: z.string().trim().nonempty().max(255),
    config: parseTaskInputConfigSchema,
  }),
});

const parseTaskOutputCorePrioritySchema = z.object({
  level: z.string().trim().nonempty(),
  score: z.number().min(0),
  reason: z.string().trim().nonempty(),
});

export const parseTaskOutputCoreSchema = z.object({
  title: z.string().trim().nonempty(),
  dueDate: z.string().trim().datetime().nullable(),
  category: z.string().trim().nonempty(),
  priority: parseTaskOutputCorePrioritySchema,
});

// Internal schema for the actual subtasks array
const parseTaskOutputSubtasksArraySchema = z
  .array(z.string().trim().nonempty())
  .min(3)
  .max(7)
  .nullable();

// Wrapper object schema for OpenAI API
export const parseTaskOutputSubtasksSchema = z.object({
  subtasks: parseTaskOutputSubtasksArraySchema,
});

export const parseTaskOutputSchema = parseTaskOutputCoreSchema.extend({
  subtasks: parseTaskOutputSubtasksArraySchema,
});

const parseTaskOutputCoreV2ErrorSchema = z.object({
  reason: z.string().trim().nonempty(),
  suggestions: z.array(z.string().trim().nonempty()).min(1).max(3),
});

export const parseTaskOutputCoreV2Schema = z
  .object({
    success: z.boolean(),
    task: parseTaskOutputCoreSchema.nullable(),
    error: parseTaskOutputCoreV2ErrorSchema.nullable(),
  })
  .refine(
    (data) => {
      if (data.success === true) {
        return data.task !== null && data.error === null;
      }

      return true;
    },
    {
      message:
        "When success is true, task must be non-null and error must be null",
    }
  )
  .refine(
    (data) => {
      if (data.success === false) {
        return data.error !== null && data.task === null;
      }

      return true;
    },
    {
      message:
        "When success is false, error must be non-null and task must be null",
    }
  );

export const parseTaskOutputJudgeSchema = z
  .object({
    overallPass: z.boolean(),
    explanation: z.string().trim().nonempty().nullable(),
    suggestedPromptImprovements: z
      .array(z.string().trim().nonempty())
      .min(1)
      .max(3)
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.overallPass === true) {
        return (
          data.explanation === null && data.suggestedPromptImprovements === null
        );
      }

      return true;
    },
    {
      message:
        "When overallPass is true, explanation and suggestedPromptImprovements must be null",
    }
  )
  .refine(
    (data) => {
      if (data.overallPass === false) {
        return (
          data.explanation !== null &&
          data.suggestedPromptImprovements !== null &&
          data.suggestedPromptImprovements.length >= 1 &&
          data.suggestedPromptImprovements.length <= 3
        );
      }

      return true;
    },
    {
      message:
        "When overallPass is false, explanation and suggestedPromptImprovements are required (1-3 items)",
    }
  );
