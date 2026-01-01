import z from "zod";

import { parseTaskHandler } from "@capabilities/parse-task/handler";
import {
  parseTaskInputSchema,
  parseTaskOutputSchema,
} from "@capabilities/parse-task/parse-task-schemas";
import { CAPABILITY } from "@constants";
import { createCapabilityResponseSchema } from "@schemas";
import { CapabilityConfig } from "@types";

export const capabilities = {
  [CAPABILITY.PARSE_TASK]: defineCapability({
    name: "parse-task",
    handler: parseTaskHandler,
    // Type assertion needed because executeCapabilityInputSchema uses z.string().transform()
    // for tokenReservation (JSON string -> object). When extending, TypeScript sees the
    // transform's input type (string) but expects the output type (object), causing a mismatch.
    // This assertion preserves the correct output type for type inference while working around
    // the transform's input type limitation.
    inputSchema: parseTaskInputSchema as z.ZodSchema<
      z.infer<typeof parseTaskInputSchema>
    >,
    outputSchema: createCapabilityResponseSchema(parseTaskOutputSchema),
    promptInjectionFields: ["body.naturalLanguage"],
  }),
} as const;

/**
 * This function ensures that:
 * - Each capability has a consistent structure
 * - Input/output types are properly inferred
 * - All required fields are provided
 */
function defineCapability<TInput, TOutput>(
  config: CapabilityConfig<TInput, TOutput>
): CapabilityConfig<TInput, TOutput> {
  return config;
}
