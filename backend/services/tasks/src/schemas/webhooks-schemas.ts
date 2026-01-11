import z from "zod";

const extractedErrorInfoSchema = z.object({
  status: z.number(),
  message: z.string(),
  context: z.record(z.string(), z.unknown()),
});

const createTaskErrorInputSchema = z.object({
  success: z.literal(false),
  error: extractedErrorInfoSchema,
  aiServiceRequestId: z.string(),
});

const openaiMetadataSchema = z.record(
  z.string(),
  z.object({
    responseId: z.string(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
    }),
    durationMs: z.number(),
  })
);

const parsedTaskSchema = z.object({
  title: z.string(),
  dueDate: z.string(),
  category: z.string(),
  priority: z.object({
    level: z.string(),
    score: z.number(),
    reason: z.string(),
  }),
  subtasks: z.array(z.string()).nullable(),
});

const createTaskSuccessInputSchema = z.object({
  success: z.literal(true),
  result: z.object({
    openaiMetadata: openaiMetadataSchema,
    result: parsedTaskSchema,
  }),
  aiServiceRequestId: z.string(),
});

export const createTaskInputSchema = z.object({
  body: z.discriminatedUnion("success", [
    createTaskErrorInputSchema,
    createTaskSuccessInputSchema,
  ]),
});
