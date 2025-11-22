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

export const parseTaskOutputSchema = parseTaskOutputCoreSchema.extend({
  // subtasks: subtasksSchema,
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
      // When success is true, task must be non-null and error must be null
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
      // When success is false, error must be non-null and task must be null
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

// const subtasksSchema = z.array(z.string().trim()).nullable();

// Note: We use a single object schema with nullable fields and refinements instead of
// a discriminated union (z.discriminatedUnion) because OpenAI's structured output API
// requires a single object type. Unions (discriminated or regular) are not supported
// and will result in an error: "schema must be a JSON Schema of 'type: \"object\"'".
// The refinements enforce the conditional logic: when overallPass is true, both fields
// must be null; when false, both fields are required (non-null).
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
      // When overallPass is true, explanation and suggestedPromptImprovements must be null
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
      // When overallPass is false, explanation and suggestedPromptImprovements are required
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
