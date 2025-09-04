import z from "zod";

export const createCapabilityResponseSchema = <T extends z.ZodTypeAny>(
  outputSchema: T
) =>
  z.object({
    metadata: z.object({
      tokens: z.object({
        input: z.number(),
        output: z.number(),
      }),
      durationMs: z.number(),
    }),
    result: outputSchema,
  });
