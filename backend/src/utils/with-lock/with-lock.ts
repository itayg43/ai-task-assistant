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
  const startTime = Date.now();

  let lock: Lock | undefined;

  try {
    lock = await redlock.acquire([lockKey], lockDuration);

    const lockAcquisitionTime = getElapsedTime(startTime);
    logger.info(`Lock acquired for ${lockKey} in ${lockAcquisitionTime}ms`);

    const fnStartTime = Date.now();
    const result = await fn();
    const fnExecutionTime = getElapsedTime(fnStartTime);
    logger.info(`Function executed for ${lockKey} in ${fnExecutionTime}ms`);

    return result;
  } catch (error) {
    const errorTime = getElapsedTime(startTime);
    logLockError(lockKey, error, errorTime, !!lock);

    throw error;
  } finally {
    if (lock) {
      await releaseLock(lock, lockKey, startTime);
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
          `Failed to acquire lock due to timeout error for ${lockKey} after ${errorTime}ms`,
          { error }
        )
      : logger.error(
          `Failed to acquire lock due to unknown error for ${lockKey} after ${errorTime}ms`,
          { error }
        );
  } else {
    logger.error(
      `Lock acquired, function execution failed for ${lockKey} after ${errorTime}ms`,
      { error }
    );
  }
}

async function releaseLock(lock: Lock, lockKey: string, startTime: number) {
  try {
    await lock.release();

    const totalTime = getElapsedTime(startTime);
    logger.info(`Lock released for ${lockKey}, total time: ${totalTime}ms`);
  } catch (error) {
    logger.error(`Failed to release lock for ${lockKey}`, {
      error,
    });
  }
}
