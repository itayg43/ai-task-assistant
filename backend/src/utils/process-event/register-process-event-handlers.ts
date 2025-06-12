import http from "http";

import shutdownHandler from "./handlers/shutdown-handler";

const registerProcessEventHandlers = (server: http.Server) => {
  process.on("SIGINT", () => shutdownHandler(server, "SIGINT"));
  process.on("SIGTERM", () => shutdownHandler(server, "SIGTERM"));

  process.on("uncaughtException", (error) =>
    shutdownHandler(server, "uncaughtException", error)
  );
  process.on("unhandledRejection", (reason) =>
    shutdownHandler(server, "unhandledRejection", reason)
  );
};

export default registerProcessEventHandlers;
