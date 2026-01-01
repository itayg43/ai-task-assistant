import { ZodError } from "zod";

import { CAPABILITY_EXECUTION_ERROR_MESSAGE } from "@constants";
import { createLogger } from "@shared/config/create-logger";
import { InternalError } from "@shared/errors";
import { CapabilityConfig } from "@types";

const logger = createLogger("executeSyncPattern");

export const executeSyncPattern = async <TInput, TOutput>(
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput,
  requestId: string
) => {
  try {
    const handlerResult = await config.handler(input, requestId);

    return config.outputSchema.parse(handlerResult);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.error(
        `Capability ${config.name} returned output that failed validation.`,
        error,
        {
          requestId,
          capability: config.name,
          validationErrorMessage: error.message,
        }
      );

      // Catch and rethrow with generic message to prevent leaking internal
      // validation details (schema structure, field names, etc.) outside the AI service.
      // This is an InternalError (500) because validation failures indicate a bug
      // in our handler logic, not a user input error.
      throw new InternalError(CAPABILITY_EXECUTION_ERROR_MESSAGE);
    }

    throw error;
  }
};
