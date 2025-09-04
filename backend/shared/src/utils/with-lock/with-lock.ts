import Redlock, { Lock, ResourceLockedError } from "redlock";

import { createLogger } from "../../config/create-logger";
import { getElapsedDuration } from "../performance";

const logger = createLogger("withLock");

export const withLock = async <T>(
  redlockClient: Redlock,
  lockKey: string,
  lockDuration: number,
  fn: () => Promise<T>
) => {
  const start = performance.now();

  let lock: Lock | undefined;

  try {
    lock = await redlockClient.acquire([lockKey], lockDuration);

    const lockAcquisitionTime = getElapsedDuration(start);
    logger.info(`Lock acquired for ${lockKey} in ${lockAcquisitionTime}ms`);

    const fnStartTime = performance.now();
    const result = await fn();
    const fnExecutionTime = getElapsedDuration(fnStartTime);
    logger.info(`Function executed for ${lockKey} in ${fnExecutionTime}ms`);

    return result;
  } catch (error) {
    logLockError(!!lock, lockKey, error, start);

    throw error;
  } finally {
    if (lock) {
      await releaseLock(lock, lockKey, start);
    }
  }
};

function logLockError(
  lockAcquired: boolean,
  lockKey: string,
  error: unknown,
  startTime: number
) {
  const errorTime = getElapsedDuration(startTime);

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

    const totalTime = getElapsedDuration(startTime);
    logger.info(`Lock released for ${lockKey}, total time: ${totalTime}ms`);
  } catch (error) {
    logger.error(`Failed to release lock for ${lockKey}`, error);
  }
}
