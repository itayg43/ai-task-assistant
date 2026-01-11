import { sendMessageToRabbitMQQueue } from "@clients/rabbitmq";
import { AI_ERROR_TYPE, RABBITMQ_QUEUE } from "@constants";
import { createLogger } from "@shared/config/create-logger";
import { ServiceUnavailableError } from "@shared/errors";
import { CapabilityConfig } from "@types";

const logger = createLogger("executeAsyncPattern");

export const executeAsyncPattern = async <TInput, TOutput>(
  requestId: string,
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput,
  callbackUrl: string
) => {
  try {
    await sendMessageToRabbitMQQueue(RABBITMQ_QUEUE.CAPABILITIES, {
      requestId,
      capability: config.name,
      input,
      callbackUrl,
    });

    return "The request has been received and will be executed shortly." as TOutput;
  } catch (error) {
    const errorMessage = `Failed to send ${config.name} message to ${RABBITMQ_QUEUE.CAPABILITIES} queue`;

    logger.error(errorMessage, error, {
      requestId,
      capability: config.name,
      callbackUrl,
    });

    throw new ServiceUnavailableError(errorMessage, {
      capability: config.name,
      type: AI_ERROR_TYPE.RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED,
    });
  }
};
