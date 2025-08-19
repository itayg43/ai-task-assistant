import z from "zod";

export const createCapabilityResponseSchema = <T extends z.ZodTypeAny>(
  outputSchema: T
) =>
  z.object({
    metadata: z.object({
      tokens: z.object({
        input: z.number().optional(),
        output: z.number().optional(),
      }),
      duration: z.number(),
    }),
    result: outputSchema,
  });
