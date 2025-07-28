import * as z from "zod";

import {
  CATEGORY,
  FREQUENCY,
  PRIORITY_LEVEL,
  PRIORITY_SCORE,
} from "@modules/tasks/tasks-constants";
import { isNonEmptyString, trimString } from "@utils/schema-helpers";

export const createTaskInputSchema = z.object({
  body: z.object({
    naturalLanguage: z.string().transform(trimString).refine(isNonEmptyString, {
      message: "Can't be empty",
    }),
  }),
});

export const parsedTaskSchema = z.object({
  title: z.string().transform(trimString).refine(isNonEmptyString),

  dueDate: z.union([z.iso.datetime(), z.literal(null)]),

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
      dayOfWeek: z.union([z.number().min(0).max(6), z.literal(null)]),
      dayOfMonth: z.union([z.number().min(1).max(31), z.literal(null)]),
      endDate: z.union([z.iso.datetime(), z.literal(null)]),
    })
    .nullable(),

  subtasks: z
    .array(z.string().transform(trimString).refine(isNonEmptyString))
    .nullable(),
});
