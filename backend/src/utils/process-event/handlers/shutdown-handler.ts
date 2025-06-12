import http from "http";

const REGULAR_EXIT_CODE = 0;
const ERROR_EXIT_CODE = 1;

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
      process.exit(ERROR_EXIT_CODE);
    }

    console.log("HTTP server closed.");
    process.exit(errorOrReason ? ERROR_EXIT_CODE : REGULAR_EXIT_CODE);
  });
};

export default shutdownHandler;
