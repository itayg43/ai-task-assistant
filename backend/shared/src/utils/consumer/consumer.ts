import { createLogger } from "../../config/create-logger";
import { PROCESS_EXIT_CODE } from "../../constants";
import { ServicesCallbacks } from "../../types";
import { registerProcessEventHandlers } from "../process-event/register-process-event-handlers";
import { performFailureCleanup } from "../server/server";

const logger = createLogger("consumer");

export async function initializeConsumer(
  serviceName: string,
  servicesCallbacks?: ServicesCallbacks
): Promise<void> {
  const servicesStartCallback = servicesCallbacks?.startCallback;
  const servicesCleanupCallbacks = servicesCallbacks?.cleanupCallbacks;

  try {
    logger.info(`###### Initialize ${serviceName} ######`);

    registerProcessEventHandlers(
      process.exit,
      servicesCleanupCallbacks
    );

    if (servicesStartCallback) {
      await servicesStartCallback();
    }

    logger.info(`###### Initialize ${serviceName} completed ######`);
  } catch (error) {
    logger.error(`###### Initialize ${serviceName} failed ######`, error);

    await performFailureCleanup(servicesCleanupCallbacks?.afterFailure);

    process.exit(PROCESS_EXIT_CODE.ERROR);
  }
}
