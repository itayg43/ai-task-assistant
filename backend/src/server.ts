import http from "http";

import { app } from "./app";
import { env, createLogger } from "@config";
import { registerProcessEventHandlers } from "@utils";
import { TAG } from "@constants";
import { redisClient } from "@clients";

const logger = createLogger(TAG.SERVER);

const server = http.createServer(app);

(async () => {
  await redisClient.connect();

  registerProcessEventHandlers(server);

  server.listen(env.PORT, () => {
    logger.info(`Running at http://localhost:${env.PORT}`);
  });
})();
