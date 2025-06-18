import http from "http";

const EXIT_CODE = {
  REGULAR: 0,
  ERROR: 1,
} as const;

let isShuttingDown = false;

const shutdownHandler = (
  server: http.Server,
  event: string,
  errorOrReason?: unknown
) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

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
