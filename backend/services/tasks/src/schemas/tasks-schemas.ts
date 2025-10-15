import z from "zod";

export const createTaskSchema = z.object({
  body: z.object({
    naturalLanguage: z.string().nonempty(),
  }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
