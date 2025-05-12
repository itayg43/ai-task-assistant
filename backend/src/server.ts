import http from "http";

import app from "./app";
import processHandlers from "./utils/process-handlers/process-handlers";

const DEFAULT_PORT = 3000;

const server = http.createServer(app);

const port = process.env.PORT || DEFAULT_PORT;

server.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

processHandlers();
