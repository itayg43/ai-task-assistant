import http from "http";

import { createLogger } from "../../../../config";
import { EXIT_CODE, SHUTDOWN_STATE, TAG } from "../../../../constants";

const logger = createLogger(TAG.SHUTDOWN_HANDLER);

const shutdownHandler = (
  server: http.Server,
  event: string,
  errorOrReason: unknown,
  shutdownView: Uint8Array
) => {
  logger.info(`Invoked by event: ${event}`);

  // use atomic compare-and-exchange to ensure only one handler proceeds
  const expected = SHUTDOWN_STATE.NOT_SHUTTING_DOWN;
  const replacement = SHUTDOWN_STATE.SHUTTING_DOWN;

  const isShutdownAlreadyInProgress =
    Atomics.compareExchange(shutdownView, 0, expected, replacement) !==
    expected;
  if (isShutdownAlreadyInProgress) {
    logger.info("Shutdown already in progress, skipping.");

    return;
  }

  if (errorOrReason) {
    logger.error(`Shutting down due to ${event}:`, {
      errorOrReason,
    });
  } else {
    logger.info(`Received ${event}. Shutting down...`);
  }

  logger.info("Closing HTTP server...");
  server.close((closeError) => {
    if (closeError) {
      logger.error(`Error while closing the server:`, {
        closeError,
      });
      process.exit(EXIT_CODE.ERROR);
    }

    const exitCode = errorOrReason ? EXIT_CODE.ERROR : EXIT_CODE.REGULAR;
    logger.info(`HTTP server closed. Exiting process. Exit code: ${exitCode}`);
    process.exit(exitCode);
  });
};

export default shutdownHandler;
