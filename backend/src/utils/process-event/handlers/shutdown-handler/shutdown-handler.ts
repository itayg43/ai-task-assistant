import http from "http";

import { createLogger } from "@config";
import { EXIT_CODE, SHUTDOWN_STATE, TAG } from "@constants";
import { closeRedisClient, destroyRedisClient } from "@clients";
import { ExitCallback } from "@types";

const logger = createLogger(TAG.SHUTDOWN_HANDLER);

const checkIfShutdownAlreadyInProgress = (shutdownView: Uint8Array) => {
  // use atomic compare-and-exchange to ensure only one handler proceeds
  const expected = SHUTDOWN_STATE.NOT_SHUTTING_DOWN;
  const replacement = SHUTDOWN_STATE.SHUTTING_DOWN;

  const result =
    Atomics.compareExchange(shutdownView, 0, expected, replacement) !==
    expected;

  return result;
};

const closeServer = async (server: http.Server): Promise<void> => {
  return new Promise((resolve, reject) => {
    server.close((closeError) => {
      if (closeError) {
        reject(closeError);
      } else {
        resolve();
      }
    });
  });
};

const processShutdown = async (
  server: http.Server,
  errorOrReason: unknown,
  exitCallback: ExitCallback
) => {
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
};

export const shutdownHandler = async (
  server: http.Server,
  event: string,
  errorOrReason: unknown,
  shutdownView: Uint8Array,
  exitCallback: ExitCallback = process.exit
) => {
  logger.info(`Invoked by event: ${event}`);

  const isShutdownAlreadyInProgress =
    checkIfShutdownAlreadyInProgress(shutdownView);
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

  await processShutdown(server, errorOrReason, exitCallback);
};
