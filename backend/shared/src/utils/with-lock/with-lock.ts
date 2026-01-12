import Redlock, { Lock, ResourceLockedError } from "redlock";

import { createLogger } from "../../config/create-logger";
import { getElapsedDuration, getStartTimestamp } from "../performance";

const logger = createLogger("withLock");

export type TWithLockContext = {
  requestId?: string;
  operation: string;
};

export const withLock = async <T>(
  redlockClient: Redlock,
  lockKey: string,
  lockDuration: number,
  fn: () => Promise<T>,
  context: TWithLockContext
) => {
  const start = getStartTimestamp();

  let lock: Lock | undefined;

  try {
    lock = await redlockClient.acquire([lockKey], lockDuration);

    const lockAcquisitionTime = getElapsedDuration(start);
    logger.info(
      `Lock acquired for ${lockKey} in ${lockAcquisitionTime}ms`,
      context
    );

    const fnStartTime = getStartTimestamp();
    const result = await fn();
    const fnExecutionTime = getElapsedDuration(fnStartTime);
    logger.info(
      `Function executed for ${lockKey} in ${fnExecutionTime}ms`,
      context
    );

    return result;
  } catch (error) {
    logLockError(!!lock, lockKey, error, start, context);

    throw error;
  } finally {
    if (lock) {
      await releaseLock(lock, lockKey, start, context);
    }
  }
};

function logLockError(
  lockAcquired: boolean,
  lockKey: string,
  error: unknown,
  startTime: number,
  context: TWithLockContext
) {
  const errorTime = getElapsedDuration(startTime);

  if (!lockAcquired) {
    error instanceof ResourceLockedError
      ? logger.warn(
          `Failed to acquire lock due to timeout error for ${lockKey} after ${errorTime}ms`,
          context
        )
      : logger.error(
          `Failed to acquire lock due to unknown error for ${lockKey} after ${errorTime}ms`,
          error,
          context
        );
  } else {
    logger.error(
      `Lock acquired, function execution failed for ${lockKey} after ${errorTime}ms`,
      error,
      context
    );
  }
}

async function releaseLock(
  lock: Lock,
  lockKey: string,
  startTime: number,
  context: TWithLockContext
) {
  try {
    await lock.release();

    const totalTime = getElapsedDuration(startTime);
    logger.info(
      `Lock released for ${lockKey}, total time: ${totalTime}ms`,
      context
    );
  } catch (error) {
    logger.error(`Failed to release lock for ${lockKey}`, error, context);
  }
}
