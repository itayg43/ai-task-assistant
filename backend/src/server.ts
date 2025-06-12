import http from "http";

import app from "./app";
import env from "./config/env";
import registerProcessEventHandlers from "./utils/register-process-event-handlers";

const server = http.createServer(app);

registerProcessEventHandlers(server);

server.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});
