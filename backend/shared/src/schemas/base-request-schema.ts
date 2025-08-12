import z from "zod";

export const baseRequestSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({}),
});
