import http from "http";

import { TAG } from "@constants";
import { shutdownHandler } from "../handlers/shutdown-handler/shutdown-handler";
import { createLogger } from "@config";

const logger = createLogger(TAG.PROCESS_EVENT_HANDLER);

// use SharedArrayBuffer for atomic operations to prevent race conditions
const shutdownBuffer = new SharedArrayBuffer(1);
const shutdownView = new Uint8Array(shutdownBuffer);

export const registerProcessEventHandlers = (server: http.Server) => {
  process.on("SIGINT", () =>
    shutdownHandler(server, "SIGINT", undefined, shutdownView)
  );
  process.on("SIGTERM", () =>
    shutdownHandler(server, "SIGTERM", undefined, shutdownView)
  );
  process.on("uncaughtException", (error) =>
    shutdownHandler(server, "uncaughtException", error, shutdownView)
  );
  process.on("unhandledRejection", (reason) =>
    shutdownHandler(server, "unhandledRejection", reason, shutdownView)
  );

  logger.info("Process event handlers registered successfully");
};
