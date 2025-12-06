import http from "http";

import { createLogger } from "../../../config/create-logger";
import { ProcessExitCallback, ServicesCleanupCallbacks } from "../../../types";
import { shutdownHandler } from "../handlers/shutdown-handler";

const logger = createLogger("processEventHandler");

const shutdownBuffer = new SharedArrayBuffer(1);
const shutdownView = new Uint8Array(shutdownBuffer);

export const registerProcessEventHandlers = (
  server: http.Server,
  processExitCallback: ProcessExitCallback,
  servicesCleanupCallbacks?: ServicesCleanupCallbacks
) => {
  process.on("SIGINT", () =>
    shutdownHandler(
      server,
      "SIGINT",
      undefined,
      shutdownView,
      processExitCallback,
      servicesCleanupCallbacks
    )
  );
  process.on("SIGTERM", () =>
    shutdownHandler(
      server,
      "SIGTERM",
      undefined,
      shutdownView,
      processExitCallback,
      servicesCleanupCallbacks
    )
  );
  process.on("uncaughtException", (error) =>
    shutdownHandler(
      server,
      "uncaughtException",
      error,
      shutdownView,
      processExitCallback,
      servicesCleanupCallbacks
    )
  );
  process.on("unhandledRejection", (reason) =>
    shutdownHandler(
      server,
      "unhandledRejection",
      reason,
      shutdownView,
      processExitCallback,
      servicesCleanupCallbacks
    )
  );

  logger.info("Process event handlers registered");
};
