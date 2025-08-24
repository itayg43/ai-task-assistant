import z from "zod";

export const baseRequestSchema = z.object({
  body: z.record(z.string(), z.unknown()),
  params: z.record(z.string(), z.unknown()),
  query: z.record(z.string(), z.unknown()),
});
