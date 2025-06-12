import http from "http";

import app from "./app";
import env from "./config/env";
import processSignalsHandlers from "./utils/process-signals-handlers";

const server = http.createServer(app);

processSignalsHandlers(server);

server.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});
