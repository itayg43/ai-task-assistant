import http from "http";

import app from "./app";
import env from "./env";
import processHandlers from "./utils/process-handlers/process-handlers";

const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`Server is running on port: ${env.PORT}`);
});

processHandlers();
