import http from "http";

import { createLogger } from "@config/logger";
import { TAG } from "@constants";

const logger = createLogger(TAG.SERVER);

export const startServer = async (
  server: http.Server,
  port: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      logger.info(`Running at http://localhost:${port}`);
      resolve();
    });

    server.once("error", (error) => {
      reject(error);
    });
  });
};
