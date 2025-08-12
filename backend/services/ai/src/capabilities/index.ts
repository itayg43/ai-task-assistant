import { parseTaskHandler } from "@capabilities/parse-task/parse-task-handler";
import {
  parseTaskInputSchema,
  parseTaskOutputSchema,
} from "@capabilities/parse-task/parse-task-schemas";
import { CAPABILITY } from "@constants";
import { CapabilityConfig } from "@types";

export const capabilities = {
  [CAPABILITY.PARSE_TASK]: defineCapability({
    name: "parse-task",
    pattern: "sync",
    handler: parseTaskHandler,
    inputSchema: parseTaskInputSchema,
    outputSchema: parseTaskOutputSchema,
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
