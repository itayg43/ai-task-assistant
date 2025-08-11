import { createLogger } from "../../config/create-logger";
import { RetryConfig } from "../../types";

const logger = createLogger("withRetry");

export const withRetry = async <T>(
  { maxAttempts, baseDelayMs, backoffMultiplier }: RetryConfig,
  fn: () => Promise<T>
) => {
  let attempt = 1;
  let lastError: unknown;

  while (attempt <= maxAttempts) {
    try {
      logger.info(`Attempt ${attempt}/${maxAttempts}`);

      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        logger.error(`Retry failed after ${maxAttempts} attempts`, {
          error,
        });

        break;
      }

      const delay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);

      logger.info(`Retry attempt ${attempt} failed, retrying in ${delay} ms`, {
        attempt,
        maxAttempts,
        delay,
        error: error instanceof Error ? error.message : String(error),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));

      attempt++;
    }
  }

  throw lastError;
};
