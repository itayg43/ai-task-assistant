import z from "zod";

import { executeCapabilityInputSchema } from "@schemas";

const parseTaskConfigPrioritiesScoreRangeSchema = z.object({
  min: z.number().min(0),
  max: z.number().positive(),
});

const parseTaskConfigPrioritiesSchema = z.object({
  levels: z.array(z.string().nonempty()),
  scores: z.record(
    z.string().nonempty(),
    parseTaskConfigPrioritiesScoreRangeSchema
  ),
  overallScoreRange: parseTaskConfigPrioritiesScoreRangeSchema,
});

export const parseTaskConfigSchema = z.object({
  categories: z.array(z.string().nonempty()),
  priorities: parseTaskConfigPrioritiesSchema,
  frequencies: z.array(z.string().nonempty()),
});

export const parseTaskInputSchema = executeCapabilityInputSchema.extend({
  body: z.object({
    naturalLanguage: z.string().nonempty().max(255),
    config: parseTaskConfigSchema,
  }),
});

const parseTaskPrioritySchema = z.object({
  level: z.string().nonempty(),
  score: z.number().min(0),
  reason: z.string().nonempty(),
});

// const recurrenceSchema = z
//   .object({
//     frequency: z.string(),
//     interval: z.number().min(1).default(1),
//     dayOfWeek: z.number().min(0).max(6).nullable(),
//     dayOfMonth: z.number().min(1).max(31).nullable(),
//     endDate: z.iso.datetime().nullable(),
//   })
//   .nullable();

// const subtasksSchema = z.array(z.string()).nullable();

export const parseTaskOutputSchema = z.object({
  title: z.string(),
  dueDate: z.string().datetime().nullable(),
  category: z.string(),
  priority: parseTaskPrioritySchema,
  // recurrence: recurrenceSchema,
  // subtasks: subtasksSchema,
});
