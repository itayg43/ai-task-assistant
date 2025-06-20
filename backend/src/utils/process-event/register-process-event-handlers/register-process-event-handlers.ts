import http from "http";

import shutdownHandler from "../handlers/shutdown-handler/shutdown-handler";

// use SharedArrayBuffer for atomic operations to prevent race conditions
const shutdownBuffer = new SharedArrayBuffer(1);
const shutdownView = new Uint8Array(shutdownBuffer);

const registerProcessEventHandlers = (server: http.Server) => {
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
};

export default registerProcessEventHandlers;
