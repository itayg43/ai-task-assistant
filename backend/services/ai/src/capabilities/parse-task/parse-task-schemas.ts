import * as z from "zod";

import { executeCapabilityInputSchema } from "@schemas";
import { isNonEmptyString, trimString } from "@shared/utils/zod-schema-helpers";

export const parseTaskConfigSchema = z.object({
  categories: z.array(
    z.string().transform(trimString).refine(isNonEmptyString)
  ),
  priorityLevels: z.array(
    z.string().transform(trimString).refine(isNonEmptyString)
  ),
  frequencies: z.array(
    z.string().transform(trimString).refine(isNonEmptyString)
  ),
});

export const parseTaskInputSchema = executeCapabilityInputSchema.extend({
  body: z.object({
    naturalLanguage: z
      .string()
      .max(255)
      .transform(trimString)
      .refine(isNonEmptyString, "Required"),
    config: parseTaskConfigSchema,
  }),
});

const parseTaskPrioritySchema = z.object({
  level: z.string().transform(trimString).refine(isNonEmptyString),
  score: z.number(),
  reason: z.string().transform(trimString).refine(isNonEmptyString),
});

const recurrenceSchema = z
  .object({
    frequency: z.string().transform(trimString).refine(isNonEmptyString),
    interval: z.number().min(1).default(1),
    dayOfWeek: z.number().min(0).max(6).nullable(),
    dayOfMonth: z.number().min(1).max(31).nullable(),
    endDate: z.iso.datetime().nullable(),
  })
  .nullable();

const subtasksSchema = z
  .array(z.string().transform(trimString).refine(isNonEmptyString))
  .nullable();

export const parseTaskOutputSchema = z.object({
  title: z.string().transform(trimString).refine(isNonEmptyString),
  dueDate: z.iso.datetime().nullable(),
  category: z.string().transform(trimString).refine(isNonEmptyString),
  priority: parseTaskPrioritySchema,
  // recurrence: recurrenceSchema,
  // subtasks: subtasksSchema,
});
