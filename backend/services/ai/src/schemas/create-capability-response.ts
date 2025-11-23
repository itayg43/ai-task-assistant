import z from "zod";

const openaiMetadataSchema = z.object({
  responseId: z.string(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
  }),
  durationMs: z.number(),
});

export const createCapabilityResponseSchema = <T extends z.ZodTypeAny>(
  outputSchema: T
) =>
  z.object({
    openaiMetadata: z.record(openaiMetadataSchema),
    result: outputSchema,
  });
