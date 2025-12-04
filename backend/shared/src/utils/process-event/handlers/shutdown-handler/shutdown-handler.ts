import http from "http";

import { createLogger } from "../../../../config/create-logger";
import {
  PROCESS_EXIT_CODE,
  SERVER_SHUTDOWN_STATE,
} from "../../../../constants";
import {
  CloseServerCleanupCallbacks,
  ProcessExitCallback,
} from "../../../../types";

const logger = createLogger("shutdownHandler");

export const shutdownHandler = async (
  server: http.Server,
  event: string,
  errorOrReason: unknown,
  shutdownView: Uint8Array,
  processExitCallback: ProcessExitCallback,
  closeServerCleanupCallbacks: CloseServerCleanupCallbacks
) => {
  logger.info(`Invoked by event: ${event}`);

  if (checkIfShutdownAlreadyInProgress(shutdownView)) {
    logger.info("Shutdown already in progress, skipping.");

    return;
  }

  if (errorOrReason) {
    logger.error(`Shutting down due to ${event}:`, errorOrReason);
  } else {
    logger.info(`Received ${event}. Shutting down...`);
  }

  await processShutdown(
    server,
    errorOrReason,
    processExitCallback,
    closeServerCleanupCallbacks
  );
};

function checkIfShutdownAlreadyInProgress(shutdownView: Uint8Array) {
  // use atomic compare-and-exchange to ensure only one handler proceeds
  const expected = SERVER_SHUTDOWN_STATE.NOT_SHUTTING_DOWN;
  const replacement = SERVER_SHUTDOWN_STATE.SHUTTING_DOWN;

  return (
    Atomics.compareExchange(shutdownView, 0, expected, replacement) !== expected
  );
}

async function processShutdown(
  server: http.Server,
  errorOrReason: unknown,
  processExitCallback: ProcessExitCallback,
  closeServerCleanupCallbacks: CloseServerCleanupCallbacks
) {
  logger.info("Closing HTTP server...");

  try {
    await closeServer(server);

    await closeServerCleanupCallbacks.afterSuccess();

    const exitCode = errorOrReason
      ? PROCESS_EXIT_CODE.ERROR
      : PROCESS_EXIT_CODE.REGULAR;
    logger.info(`HTTP server closed. Exiting process. Exit code: ${exitCode}`);

    processExitCallback(exitCode);
  } catch (error) {
    logger.error(`Error while closing the server:`, error);

    try {
      await closeServerCleanupCallbacks.afterFailure();
    } catch (cleanupError) {
      logger.error(
        `Error during failure cleanup (non-fatal, continuing shutdown):`,
        cleanupError
      );
    }

    processExitCallback(PROCESS_EXIT_CODE.ERROR);
  }
}

async function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((closeError) => {
      if (closeError) {
        reject(closeError);
      } else {
        resolve();
      }
    });
  });
}
