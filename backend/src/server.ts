import http from "http";

import app from "./app";
import env from "./config/env";
import registerProcessEventHandlers from "./utils/process-event/register-process-event-handlers/register-process-event-handlers";
import logger from "./config/logger";
import { TAG } from "./constants/tag";

const log = logger(TAG.SERVER);

const server = http.createServer(app);

registerProcessEventHandlers(server);

server.listen(env.PORT, () => {
  log.info(`Running at http://localhost:${env.PORT}`);
});
