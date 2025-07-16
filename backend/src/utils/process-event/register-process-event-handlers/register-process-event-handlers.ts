import http from "http";

import { createLogger } from "@config/logger";
import { TAG } from "@constants";
import { ExitCallback } from "@types";
import { shutdownHandler } from "../handlers";

const logger = createLogger(TAG.PROCESS_EVENT_HANDLER);

// use SharedArrayBuffer for atomic operations to prevent race conditions
const shutdownBuffer = new SharedArrayBuffer(1);
const shutdownView = new Uint8Array(shutdownBuffer);

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
