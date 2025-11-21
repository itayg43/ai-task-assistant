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
  frequencies: z.array(z.string().trim().nonempty()),
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
  title: z.string().trim(),
  dueDate: z.string().trim().datetime().nullable(),
  category: z.string().trim(),
  priority: parseTaskOutputCorePrioritySchema,
});

export const parseTaskOutputSchema = parseTaskOutputCoreSchema.extend({
  // recurrence: recurrenceSchema,
  // subtasks: subtasksSchema,
});

// const recurrenceSchema = z
//   .object({
//     frequency: z.string().trim(),
//     interval: z.number().min(1).default(1),
//     dayOfWeek: z.number().min(0).max(6).nullable(),
//     dayOfMonth: z.number().min(1).max(31).nullable(),
//     endDate: z.iso.datetime().nullable(),
//   })
//   .nullable();

// const subtasksSchema = z.array(z.string().trim()).nullable();

export const parseTaskOutputJudgeSchema = z.object({
  overallPass: z.boolean(),
  explanation: z.string().nullable(),
  suggestedPromptImprovements: z.array(z.string()).nullable(),
});
