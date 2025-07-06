import { Lock, ResourceLockedError } from "redlock";

import { redlock } from "@clients";
import { createLogger } from "@config";
import { TAG } from "@constants";
import { getElapsedTime } from "@utils";

const logger = createLogger(TAG.WITH_LOCK);

export const withLock = async <T>(
  lockKey: string,
  lockDuration: number,
  fn: () => Promise<T>
) => {
  const startTimestamp = Date.now();

  let lock: Lock | undefined;

  try {
    lock = await redlock.acquire([lockKey], lockDuration);

    const lockAcquisitionTime = getElapsedTime(startTimestamp);
    logger.info(
      `Lock acquired for key ${lockKey} in ${lockAcquisitionTime} ms`
    );

    const fnStartTime = Date.now();
    const result = await fn();
    const functionExecutionTime = getElapsedTime(fnStartTime);
    logger.info(
      `Function executed for key ${lockKey} in ${functionExecutionTime} ms`
    );

    return result;
  } catch (error) {
    const errorTime = getElapsedTime(startTimestamp);
    logLockError(lockKey, error, errorTime, !!lock);

    throw error;
  } finally {
    if (lock) {
      try {
        await lock.release();

        const totalTime = getElapsedTime(startTimestamp);
        logger.info(
          `Lock released for key ${lockKey}, total time: ${totalTime} ms`
        );
      } catch (error) {
        logger.error(`Failed to release lock for key ${lockKey}`, {
          error,
        });
      }
    }
  }
};

function logLockError(
  lockKey: string,
  error: unknown,
  errorTime: number,
  lockAcquired: boolean
) {
  if (!lockAcquired) {
    error instanceof ResourceLockedError
      ? logger.warn(
          `Failed to acquire lock due to timeout error for key ${lockKey} after ${errorTime} ms`,
          { error }
        )
      : logger.error(
          `Failed to acquire lock due to unknown error for key ${lockKey} after ${errorTime} ms`,
          { error }
        );
  } else {
    logger.error(
      `Lock acquired, function execution failed for key ${lockKey} after ${errorTime} ms`,
      { error }
    );
  }
}
