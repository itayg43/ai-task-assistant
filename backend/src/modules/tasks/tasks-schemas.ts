import * as z from "zod";

import { CATEGORY, FREQUENCY, PRIORITY } from "@modules/tasks/tasks-constants";
import { isNonEmptyString, trimString } from "@utils/schema-helpers";

export const createTaskInputSchema = z.object({
  body: z.object({
    naturalLanguage: z.string().transform(trimString).refine(isNonEmptyString, {
      message: "Can't be empty",
    }),
  }),
});

export const createTaskAiResponseSchema = z.object({
  title: z.string().transform(trimString).refine(isNonEmptyString),
  dueDate: z.iso.datetime().optional(),
  priority: z.enum(PRIORITY),
  category: z.enum(CATEGORY),
  recurrence: z
    .object({
      frequency: z.enum(FREQUENCY),
      interval: z.number().min(1).default(1),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      endDate: z.iso.datetime().optional(),
    })
    .nullable(),
  subtasks: z
    .array(z.string().transform(trimString).refine(isNonEmptyString))
    .optional(),
});
