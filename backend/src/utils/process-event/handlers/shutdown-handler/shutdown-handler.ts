import http from "http";

import { EXIT_CODE } from "../../../../constants/exit-code";

const shutdownHandler = (
  server: http.Server,
  event: string,
  errorOrReason: unknown,
  shutdownView: Uint8Array
) => {
  // use atomic compare-and-exchange to ensure only one handler proceeds
  // 0 = not shutting down, 1 = shutting down
  const expected = 0;
  const replacement = 1;

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
