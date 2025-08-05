import * as z from "zod";

import {
  CATEGORY,
  FREQUENCY,
  PRIORITY_LEVEL,
  PRIORITY_SCORE,
} from "@capabilities/parse-task/parse-task-constants";
import { isNonEmptyString, trimString } from "@shared/utils/zod-schema-helpers";

export const parseTaskInputSchema = z.object({
  body: z.object({
    naturalLanguage: z
      .string()
      .max(255)
      .transform(trimString)
      .refine(isNonEmptyString, {
        message: "Can't be empty",
      }),
  }),
});

export const parseTaskOutputSchema = z.object({
  title: z.string().transform(trimString).refine(isNonEmptyString),

  dueDate: z.iso.datetime().nullable(),

  priorityLevel: z.enum(PRIORITY_LEVEL),
  priorityScore: z
    .number()
    .min(PRIORITY_SCORE.LOW.min)
    .max(PRIORITY_SCORE.CRITICAL.max),
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
