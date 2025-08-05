export const trimString = (value: string) => value.trim();

/**
 * Checks if a string is non-empty.
 *
 * IMPORTANT: This function is designed to be used with Zod's transform + refine pattern.
 * Use it in a .refine() after applying .transform(trimString) to ensure proper validation.
 *
 * Example:
 * ```typescript
 * z.string()
 *   .transform(trimString)
 *   .refine(isNonEmptyString, "String cannot be empty")
 * ```
 */
export const isNonEmptyString = (value: string) => value.length > 0;
