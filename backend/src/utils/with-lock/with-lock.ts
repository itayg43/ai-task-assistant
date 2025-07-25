import { Lock, ResourceLockedError } from "redlock";

import { redlock } from "@clients/redlock";
import { createLogger } from "@config/logger";
import { getCurrentTime, getElapsedTime } from "@utils/time-date";

const logger = createLogger("withLock");

export const withLock = async <T>(
  lockKey: string,
  lockDuration: number,
  fn: () => Promise<T>
) => {
  const startTime = getCurrentTime();

  let lock: Lock | undefined;

  try {
    lock = await redlock.acquire([lockKey], lockDuration);

    const lockAcquisitionTime = getElapsedTime(startTime);
    logger.info(`Lock acquired for ${lockKey} in ${lockAcquisitionTime}ms`);

    const fnStartTime = getCurrentTime();
    const result = await fn();
    const fnExecutionTime = getElapsedTime(fnStartTime);
    logger.info(`Function executed for ${lockKey} in ${fnExecutionTime}ms`);

    return result;
  } catch (error) {
    logLockError(!!lock, lockKey, error, startTime);

    throw error;
  } finally {
    if (lock) {
      await releaseLock(lock, lockKey, startTime);
    }
  }
};

function logLockError(
  lockAcquired: boolean,
  lockKey: string,
  error: unknown,
  startTime: number
) {
  const errorTime = getElapsedTime(startTime);

  if (!lockAcquired) {
    error instanceof ResourceLockedError
      ? logger.warn(
          `Failed to acquire lock due to timeout error for ${lockKey} after ${errorTime}ms`
        )
      : logger.error(
          `Failed to acquire lock due to unknown error for ${lockKey} after ${errorTime}ms`,
          error
        );
  } else {
    logger.error(
      `Lock acquired, function execution failed for ${lockKey} after ${errorTime}ms`,
      error
    );
  }
}

async function releaseLock(lock: Lock, lockKey: string, startTime: number) {
  try {
    await lock.release();

    const totalTime = getElapsedTime(startTime);
    logger.info(`Lock released for ${lockKey}, total time: ${totalTime}ms`);
  } catch (error) {
    logger.error(`Failed to release lock for ${lockKey}`, error);
  }
}
