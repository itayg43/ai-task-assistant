import { publishJob } from "@clients/rabbitmq";
import { RABBITMQ_QUEUE } from "@constants";
import { createLogger } from "@shared/config/create-logger";
import { InternalError } from "@shared/errors";
import { CapabilityConfig, TCapabilityJobPayload } from "@types";

const logger = createLogger("executeAsyncPattern");

/**
 * Flow:
 * 1. Create job payload with capability name, full validated input, and request ID
 * 2. Publish job to RabbitMQ queue
 * 3. Return message indicating the capability has been queued (controller returns 202 with aiServiceRequestId)
 *
 * We pass the capability name (from input.params.capability) instead of the full
 * CapabilityConfig because CapabilityConfig contains functions (handler) and Zod schemas
 * that cannot be serialized to JSON. The worker will look up the config from the
 * capabilities registry using this name.
 */
export const executeAsyncPattern = async <TInput, TOutput>(
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput,
  requestId: string
) => {
  const baseLogContext = {
    requestId,
    capability: config.name,
    queueName: RABBITMQ_QUEUE.AI_CAPABILITY_JOBS,
  };

  try {
    logger.info("executeAsyncPattern - publishing job", baseLogContext);

    // Type assertion: TInput is validated and matches the expected input type for this capability
    const jobPayload: TCapabilityJobPayload<typeof config.name> = {
      capability: config.name,
      input: input as TCapabilityJobPayload<typeof config.name>["input"],
      requestId,
    };

    await publishJob(RABBITMQ_QUEUE.AI_CAPABILITY_JOBS, jobPayload);

    logger.info(
      "executeAsyncPattern - job published successfully",
      baseLogContext
    );

    return {
      message: `The ${config.name} capability has been added to the queue and will start processing shortly.`,
    } as TOutput;
  } catch (error) {
    logger.error(
      "executeAsyncPattern - failed to publish job",
      error,
      baseLogContext
    );

    throw new InternalError("Failed to queue job for processing");
  }
};
