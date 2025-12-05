import { Express } from "express";
import http from "http";

import { createLogger } from "../../config/create-logger";
import { PROCESS_EXIT_CODE } from "../../constants";
import { ServicesCallbacks, ServicesCleanupCallbacks } from "../../types";
import { registerProcessEventHandlers } from "../process-event/register-process-event-handlers";

const logger = createLogger("server");

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

export const closeServer = (server: http.Server): Promise<void> => {
  return new Promise((resolve, reject) => {
    server.close((closeError) => {
      if (closeError) {
        reject(closeError);
      } else {
        resolve();
      }
    });
  });
};

export async function initializeServer(
  serviceName: string,
  servicePort: number,
  app: Express,
  servicesCallbacks?: ServicesCallbacks
): Promise<void> {
  const servicesStartCallback = servicesCallbacks?.startCallback;
  const servicesCleanupCallbacks = servicesCallbacks?.cleanupCallbacks;

  try {
    logger.info(`###### Initialize ${serviceName} ######`);

    const server = http.createServer(app);

    registerProcessEventHandlers(
      server,
      process.exit,
      servicesCleanupCallbacks
    );

    if (servicesStartCallback) {
      await servicesStartCallback();
    }

    await startServer(server, servicePort);

    logger.info(`###### Initialize ${serviceName} completed ######`);
  } catch (error) {
    logger.error(`###### Initialize ${serviceName} failed ######`, error);

    await performFailureCleanup(servicesCleanupCallbacks?.afterFailure);

    process.exit(PROCESS_EXIT_CODE.ERROR);
  }
}

export async function performFailureCleanup(
  afterFailureCallback?: ServicesCleanupCallbacks["afterFailure"]
): Promise<void> {
  if (!afterFailureCallback) {
    return;
  }

  try {
    await afterFailureCallback();
  } catch (cleanupError) {
    logger.error(
      `Error during failure cleanup (non-fatal, continuing shutdown):`,
      cleanupError
    );
  }
}
