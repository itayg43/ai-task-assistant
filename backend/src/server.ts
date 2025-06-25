import http from "http";

import app from "./app";
import env from "./config/env";
import registerProcessEventHandlers from "./utils/process-event/register-process-event-handlers/register-process-event-handlers";
import createLogger from "./config/logger";
import { TAG } from "./constants";

const logger = createLogger(TAG.SERVER);

const server = http.createServer(app);

registerProcessEventHandlers(server);

server.listen(env.PORT, () => {
  logger.info(`Running at http://localhost:${env.PORT}`);
});
