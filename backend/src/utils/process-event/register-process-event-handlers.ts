import http from "http";

import shutdownHandler, {
  ShutdownState,
} from "./handlers/shutdown-handler/shutdown-handler";

const shutdownState: ShutdownState = {
  isShuttingDown: false,
};

const registerProcessEventHandlers = (server: http.Server) => {
  process.on("SIGINT", () =>
    shutdownHandler(server, "SIGINT", undefined, shutdownState)
  );
  process.on("SIGTERM", () =>
    shutdownHandler(server, "SIGTERM", undefined, shutdownState)
  );

  process.on("uncaughtException", (error) =>
    shutdownHandler(server, "uncaughtException", error, shutdownState)
  );
  process.on("unhandledRejection", (reason) =>
    shutdownHandler(server, "unhandledRejection", reason, shutdownState)
  );
};

export default registerProcessEventHandlers;
