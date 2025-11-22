import { StatusCodes } from "http-status-codes";

import { createLogger } from "../../config/create-logger";
import { BaseError } from "../../errors";
import { RetryConfig } from "../../types";

const logger = createLogger("withRetry");

const isNonRetryableError = (error: unknown): boolean => {
  if (error instanceof BaseError) {
    return error.statusCode === StatusCodes.BAD_REQUEST;
  }

  return false;
};

export const withRetry = async <T>(
  { maxAttempts, baseDelayMs, backoffMultiplier }: RetryConfig,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
) => {
  let attempt = 1;
  let lastError: unknown;
  let lastErrorMessage: string;

  while (attempt <= maxAttempts) {
    try {
      logger.info(`Attempt ${attempt}/${maxAttempts}`, context);

      return await fn();
    } catch (error) {
      lastError = error;
      lastErrorMessage =
        lastError instanceof Error ? lastError.message : String(lastError);

      if (isNonRetryableError(error)) {
        logger.info(`Non-retryable error encountered, not retrying`, {
          errorMessage: lastErrorMessage,
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
        errorMessage: lastErrorMessage,
        ...context,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));

      attempt++;
    }
  }

  throw lastError;
};
