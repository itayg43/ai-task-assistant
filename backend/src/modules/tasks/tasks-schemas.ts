import * as z from "zod";

export const createTaskSchema = z.object({
  body: z.object({
    naturalLanguageTask: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length, {
        message: "can't be empty",
      }),
  }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
