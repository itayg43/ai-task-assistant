import * as z from "zod";

import { isNonEmptyString, trimString } from "@shared/utils/zod-schema-helpers";

export const createTaskSchema = z.object({
  body: z.object({
    naturalLanguage: z.string().transform(trimString).refine(isNonEmptyString),
  }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
