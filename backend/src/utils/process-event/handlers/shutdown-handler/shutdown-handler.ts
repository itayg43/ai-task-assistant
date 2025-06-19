import http from "http";

export const EXIT_CODE = {
  REGULAR: 0,
  ERROR: 1,
} as const;

export type ShutdownState = {
  isShuttingDown: boolean;
};

const shutdownHandler = (
  server: http.Server,
  event: string,
  errorOrReason: unknown,
  state: ShutdownState
) => {
  if (state.isShuttingDown) {
    return;
  }
  state.isShuttingDown = true;

  if (errorOrReason) {
    console.error(`Shutting down due to ${event}:`, errorOrReason);
  } else {
    console.log(`Received ${event}. Shutting down...`);
  }

  server.close((closeError) => {
    if (closeError) {
      console.error("Error while closing the server:", closeError);
      process.exit(EXIT_CODE.ERROR);
    }

    console.log("HTTP server closed.");
    process.exit(errorOrReason ? EXIT_CODE.ERROR : EXIT_CODE.REGULAR);
  });
};

export default shutdownHandler;
