import * as z from "zod";

export const createTaskSchema = z.object({
  body: z.object({
    naturalLanguage: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length, {
        message: "Can't be empty",
      }),
  }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
