import http from "http";

import { closeRedisClient, destroyRedisClient } from "@clients";
import { createLogger } from "@config/logger";
import { EXIT_CODE, SHUTDOWN_STATE, TAG } from "@constants";
import { ExitCallback } from "@types";

const logger = createLogger(TAG.SHUTDOWN_HANDLER);

export const shutdownHandler = async (
  server: http.Server,
  event: string,
  errorOrReason: unknown,
  shutdownView: Uint8Array,
  exitCallback: ExitCallback = process.exit
) => {
  logger.info(`Invoked by event: ${event}`);

  if (checkIfShutdownAlreadyInProgress(shutdownView)) {
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

  await processShutdown(server, errorOrReason, exitCallback);
};

function checkIfShutdownAlreadyInProgress(shutdownView: Uint8Array) {
  // use atomic compare-and-exchange to ensure only one handler proceeds
  const expected = SHUTDOWN_STATE.NOT_SHUTTING_DOWN;
  const replacement = SHUTDOWN_STATE.SHUTTING_DOWN;

  return (
    Atomics.compareExchange(shutdownView, 0, expected, replacement) !== expected
  );
}

async function processShutdown(
  server: http.Server,
  errorOrReason: unknown,
  exitCallback: ExitCallback
) {
  logger.info("Closing HTTP server...");

  try {
    await closeServer(server);

    await closeRedisClient();

    const exitCode = errorOrReason ? EXIT_CODE.ERROR : EXIT_CODE.REGULAR;
    logger.info(`HTTP server closed. Exiting process. Exit code: ${exitCode}`);

    exitCallback(exitCode);
  } catch (error) {
    logger.error(`Error while closing the server:`, {
      error,
    });

    destroyRedisClient();

    exitCallback(EXIT_CODE.ERROR);
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
