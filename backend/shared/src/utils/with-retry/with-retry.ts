import { createLogger } from "../../config/create-logger";
import { RetryConfig } from "../../types";

const logger = createLogger("withRetry");

export const withRetry = async <T>(
  { maxAttempts, baseDelayMs, backoffMultiplier }: RetryConfig,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
) => {
  let attempt = 1;
  let lastError: unknown;

  while (attempt <= maxAttempts) {
    try {
      logger.info(`Attempt ${attempt}/${maxAttempts}`, context);

      return await fn();
    } catch (error) {
      lastError = error;

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
        error:
          lastError instanceof Error ? lastError.message : String(lastError),
        ...context,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));

      attempt++;
    }
  }

  throw lastError;
};
