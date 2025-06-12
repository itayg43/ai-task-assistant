import http from "http";

const processSignalsHandlers = (server: http.Server) => {
  const handler = (signal: string) => {
    console.log(`Received ${signal}`);

    server.close((error) => {
      if (error) {
        console.error("Error during close:", error);
        process.exit(1);
      }

      console.log("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => handler("SIGINT"));
  process.on("SIGTERM", () => handler("SIGTERM"));
};

export default processSignalsHandlers;
