import { createLogger } from "../../config/create-logger";
import { RetryConfig } from "../../types";
import {
  extractErrorInfo,
  isNonRetryableError,
} from "../../utils/extract-error-info";

const logger = createLogger("withRetry");

export const withRetry = async <T>(
  config: RetryConfig,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
) => {
  const { maxAttempts, baseDelayMs, backoffMultiplier } = config;

  let attempt = 1;
  let lastError: unknown;

  while (attempt <= maxAttempts) {
    try {
      logger.info(`Attempt ${attempt}/${maxAttempts}`, context);

      return await fn();
    } catch (error) {
      lastError = error;

      const extractedErrorInfo = extractErrorInfo(lastError);

      if (isNonRetryableError(extractedErrorInfo)) {
        logger.info(`Non-retryable error encountered, not retrying`, {
          errorMessage: extractedErrorInfo.message,
          ...context,
        });

        break;
      }

      if (attempt === maxAttempts) {
        logger.error(
          `Retry failed after ${maxAttempts} attempts`,
          lastError,
          context
        );

        break;
      }

      const delay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);

      logger.info(`Retry attempt ${attempt} failed, retrying in ${delay} ms`, {
        attempt,
        maxAttempts,
        delay,
        errorMessage: extractedErrorInfo.message,
        ...context,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));

      attempt++;
    }
  }

  throw lastError;
};
