import http from "http";

import { EXIT_CODE } from "../../../../constants/exit-code";
import { SHUTDOWN_STATE } from "../../../../constants/shutdown-state";

const shutdownHandler = (
  server: http.Server,
  event: string,
  errorOrReason: unknown,
  shutdownView: Uint8Array
) => {
  // use atomic compare-and-exchange to ensure only one handler proceeds
  const expected = SHUTDOWN_STATE.NOT_SHUTTING_DOWN;
  const replacement = SHUTDOWN_STATE.SHUTTING_DOWN;

  if (
    Atomics.compareExchange(shutdownView, 0, expected, replacement) !== expected
  ) {
    // another handler already started the shutdown process
    return;
  }

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
