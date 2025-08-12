import * as z from "zod";

import {
  CATEGORY,
  FREQUENCY,
  PRIORITY_LEVEL,
  VALIDATION_LIMITS,
} from "@capabilities/parse-task/parse-task-constants";
import { baseRequestSchema } from "@shared/schemas";
import { isNonEmptyString, trimString } from "@shared/utils/zod-schema-helpers";

export const parseTaskInputSchema = baseRequestSchema.extend({
  body: z.object({
    naturalLanguage: z
      .string()
      .max(VALIDATION_LIMITS.MAX_NATURAL_LANGUAGE_LENGTH)
      .transform(trimString)
      .refine(isNonEmptyString, "Required"),
  }),
});

export const parseTaskOutputSchema = z.object({
  title: z.string().transform(trimString).refine(isNonEmptyString),

  dueDate: z.iso.datetime().nullable(),

  priorityLevel: z.enum(PRIORITY_LEVEL),
  priorityScore: z
    .number()
    .min(VALIDATION_LIMITS.MIN_PRIORITY_SCORE)
    .max(VALIDATION_LIMITS.MAX_PRIORITY_SCORE),
  priorityReason: z.string().transform(trimString).refine(isNonEmptyString),

  category: z.enum(CATEGORY),

  recurrence: z
    .object({
      frequency: z.enum(FREQUENCY),
      interval: z.number().min(1).default(1),
      dayOfWeek: z.number().min(0).max(6).nullable(),
      dayOfMonth: z.number().min(1).max(31).nullable(),
      endDate: z.iso.datetime().nullable(),
    })
    .nullable(),

  subtasks: z
    .array(z.string().transform(trimString).refine(isNonEmptyString))
    .nullable(),
});
