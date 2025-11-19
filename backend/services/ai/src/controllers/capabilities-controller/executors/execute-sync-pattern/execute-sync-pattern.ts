import { ZodError } from "zod";

import { CAPABILITY_EXECUTION_ERROR_MESSAGE } from "@constants";
import { createLogger } from "@shared/config/create-logger";
import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { InternalError } from "@shared/errors";
import { withDurationAsync } from "@shared/utils/with-duration";
import { withRetry } from "@shared/utils/with-retry";
import { CapabilityConfig } from "@types";

const logger = createLogger("executeSyncPattern");

export const executeSyncPattern = async <TInput, TOutput>(
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput,
  requestId: string
) => {
  return await withDurationAsync(async () => {
    try {
      // Validation is inside retry because handlers call external AI services (e.g., OpenAI)
      // that can return partial or invalid responses due to:
      // - Insufficient output tokens (truncated responses)
      // - AI refusal to generate content
      // - Transient parsing/structure issues
      // These are retryable failures, not bugs in our handler implementation.
      // Retrying allows the AI service to potentially return a complete, valid response.
      return await withRetry(
        DEFAULT_RETRY_CONFIG,
        async () => {
          const handlerResult = await config.handler(input, requestId);
          return config.outputSchema.parse(handlerResult);
        },
        {
          requestId,
        }
      );
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

        throw new InternalError(CAPABILITY_EXECUTION_ERROR_MESSAGE, {
          aiServiceRequestId: requestId,
        });
      }

      throw error;
    }
  });
};
