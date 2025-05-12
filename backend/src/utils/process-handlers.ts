import signalHandler from "./signal-handler/signal-handler";

const processHandlers = () => {
  process.on("SIGINT", signalHandler(0, "SIGINT: Gracefully shutting down..."));

  process.on(
    "SIGTERM",
    signalHandler(0, "SIGINT: Gracefully shutting down...")
  );

  process.on("uncaughtException", signalHandler(1));

  process.on("unhandledRejection", signalHandler(1));
};

export default processHandlers;
