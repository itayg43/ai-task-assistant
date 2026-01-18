import http from "http";

import { createLogger } from "../../../../config/create-logger";
import { PROCESS_EXIT_CODE } from "../../../../constants";
import {
  ProcessExitCallback,
  ServicesCleanupCallbacks,
} from "../../../../types";
import { closeServer, performFailureCleanup } from "../../../server";
import { checkIfShutdownAlreadyInProgress } from "../../shutdown-state";

const logger = createLogger("shutdownHandler");

export const shutdownHandler = async (
  server: http.Server | undefined,
  event: string,
  errorOrReason: unknown,
  shutdownView: Uint8Array,
  processExitCallback: ProcessExitCallback,
  servicesCleanupCallbacks?: ServicesCleanupCallbacks
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
    servicesCleanupCallbacks
  );
};

async function processShutdown(
  server: http.Server | undefined,
  errorOrReason: unknown,
  processExitCallback: ProcessExitCallback,
  servicesCleanupCallbacks?: ServicesCleanupCallbacks
) {
  try {
    if (server) {
      logger.info("Closing HTTP server...");
      await closeServer(server);
    }

    if (servicesCleanupCallbacks) {
      await servicesCleanupCallbacks.afterSuccess();
    }

    const exitCode = errorOrReason
      ? PROCESS_EXIT_CODE.ERROR
      : PROCESS_EXIT_CODE.REGULAR;

    logger.info(
      `${server ? "HTTP server closed. " : ""}Exiting process. Exit code: ${exitCode}`
    );

    processExitCallback(exitCode);
  } catch (error) {
    logger.error(
      `${server ? "Error while closing the server" : "Error during shutdown"}:`,
      error
    );

    await performFailureCleanup(servicesCleanupCallbacks?.afterFailure);

    processExitCallback(PROCESS_EXIT_CODE.ERROR);
  }
}
