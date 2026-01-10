import { sendMessageToRabbitMQQueue } from "@clients/rabbitmq";
import { AI_ERROR_TYPE, RABBITMQ_QUEUE } from "@constants";
import { createLogger } from "@shared/config/create-logger";
import { InternalError } from "@shared/errors";
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

    return {
      message: "The request has been received and will be executed shortly.",
    } as TOutput;
  } catch (error) {
    const errorMessage = "Failed to send message to queue";

    logger.error(errorMessage, error, {
      requestId,
      capability: config.name,
    });

    throw new InternalError(errorMessage, {
      capability: config.name,
      type: AI_ERROR_TYPE.RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED,
    });
  }
};
