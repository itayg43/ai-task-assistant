import http from "http";

import { createLogger } from "@config/logger";
import { ExitCallback } from "@types";
import { shutdownHandler } from "@utils/process-event/handlers/shutdown-handler";

const logger = createLogger("processEventHandler");

// use SharedArrayBuffer for atomic operations to prevent race conditions
const shutdownBuffer = new SharedArrayBuffer(1);
const shutdownView = new Uint8Array(shutdownBuffer);

// Using 'once' would ensure each handler runs only once per event type (e.g., only the first SIGINT).
// However, multiple different events (SIGINT, SIGTERM, uncaughtException, unhandledRejection) can all trigger shutdown.
// These events can occur nearly simultaneously, so even with 'once', multiple handlers could run in parallel.
// Therefore, we must use atomic protection (SharedArrayBuffer + Atomics) to ensure only one shutdown sequence proceeds.
// This guards against race conditions regardless of whether 'on' or 'once' is used.
export const registerProcessEventHandlers = (
  server: http.Server,
  exitCallback: ExitCallback = process.exit
) => {
  // IMPORTANT: Do not use async/await in these process.on handlers.
  // Node.js does NOT wait for async signal handlers to complete before continue.
  process.on("SIGINT", () =>
    shutdownHandler(server, "SIGINT", undefined, shutdownView, exitCallback)
  );
  process.on("SIGTERM", () =>
    shutdownHandler(server, "SIGTERM", undefined, shutdownView, exitCallback)
  );
  process.on("uncaughtException", (error) =>
    shutdownHandler(
      server,
      "uncaughtException",
      error,
      shutdownView,
      exitCallback
    )
  );
  process.on("unhandledRejection", (reason) =>
    shutdownHandler(
      server,
      "unhandledRejection",
      reason,
      shutdownView,
      exitCallback
    )
  );

  logger.info("Process event handlers registered");
};
