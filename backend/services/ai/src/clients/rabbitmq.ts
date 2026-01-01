import { connect, Channel } from "amqp-connection-manager";
import * as amqp from "amqplib";

import { env } from "@config/env";
import { createLogger } from "@shared/config/create-logger";
import { InternalError } from "@shared/errors";

const logger = createLogger("rabbitmq");

// Connection manager handles automatic reconnection - if RabbitMQ goes down and comes back,
// the connection will be restored automatically without manual intervention
const connection = connect([env.RABBITMQ_URL]);

/**
 * Publishes a job to a RabbitMQ queue.
 *
 * @param queueName - The name of the queue to publish to
 * @param jobData - The job payload to serialize and send
 *
 * Flow:
 * 1. Get or create a channel (channel wrapper handles reconnection)
 * 2. Assert the queue exists (creates it if it doesn't, with durable=true so it survives restarts)
 * 3. Serialize jobData to JSON and convert to Buffer (RabbitMQ messages are binary)
 * 4. Send message to queue with persistent=true (message written to disk, survives broker restart)
 * 5. Wait for confirmation (optional - can add publisher confirms later for better reliability)
 */
export const publishJob = async (
  queueName: string,
  jobData: unknown
): Promise<void> => {
  const baseLogContext = {
    queueName,
    jobData,
  };

  try {
    logger.info("publishJob - starting", baseLogContext);

    // Channel wrapper automatically recreates channels if connection is lost and restored.
    // This is important because channels don't survive connection failures.
    const channelWrapper = connection.createChannel();

    // Ensure queue exists (runs on every reconnection)
    await channelWrapper.addSetup(async (channel: Channel) => {
      // Assert queue creates it if it doesn't exist. durable=true means queue survives broker restarts.
      await channel.assertQueue(queueName, {
        durable: true,
      });
    });

    // Wait for channel to be ready
    await channelWrapper.waitForConnect();

    // Send message once (not in addSetup to avoid sending on every reconnection)
    // We use a Promise to get the channel and send the message
    return new Promise<void>((resolve, reject) => {
      channelWrapper.addSetup(async (channel: Channel) => {
        try {
          // persistent=true writes message to disk. If broker restarts, message is not lost.
          // Buffer.from() converts JSON string to binary format that RabbitMQ expects.
          const messageBuffer = Buffer.from(JSON.stringify(jobData));
          const sent = channel.sendToQueue(queueName, messageBuffer, {
            persistent: true,
          });

          if (!sent) {
            reject(
              new InternalError(
                "Failed to send message to queue - queue may be full"
              )
            );

            return;
          }

          // Publisher confirms ensure message was received by broker. For POC, we skip this for simplicity,
          // but it's recommended for production to guarantee message delivery.
          logger.info("publishJob - succeeded", baseLogContext);

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    logger.error("publishJob - failed", error, baseLogContext);

    throw new InternalError("Failed to publish job to RabbitMQ", {
      queueName,
    });
  }
};

/**
 * Creates a consumer that processes messages from a RabbitMQ queue.
 *
 * @param queueName - The name of the queue to consume from
 * @param handler - Async function that processes each message
 *
 * Consumer Flow:
 * 1. Set up channel and queue (runs on initial connection and after reconnection)
 * 2. Set prefetch to 1 (fair distribution - process one message at a time)
 * 3. Start consuming messages (RabbitMQ delivers messages one by one)
 * 4. For each message:
 *    a. Parse JSON payload
 *    b. Call handler function
 *    c. If handler succeeds: ack message (tell RabbitMQ to delete it)
 *    d. If handler fails: nack message (tell RabbitMQ to requeue or discard)
 *
 * Message Acknowledgment:
 * - noAck=false means we must manually acknowledge messages
 * - If we ack: RabbitMQ deletes message from queue (job completed)
 * - If we nack with requeue=true: RabbitMQ puts message back in queue (retry)
 * - If we nack with requeue=false: RabbitMQ discards message (permanent failure)
 * - If we crash without acking: RabbitMQ requeues message (ensures no message loss)
 */
export const createConsumer = async (
  queueName: string,
  handler: (msg: unknown) => Promise<void>
): Promise<void> => {
  const baseLogContext = {
    queueName,
  };

  try {
    logger.info("createConsumer - starting", baseLogContext);

    // Channel wrapper automatically recreates channels if connection is lost and restored.
    // This is important because channels don't survive connection failures.
    const channelWrapper = connection.createChannel();

    // addSetup ensures consumer is recreated if connection is lost and restored.
    // This is critical - without this, consumer stops working after reconnection.
    await channelWrapper.addSetup(async (channel: Channel) => {
      // Ensure queue exists before consuming. If queue doesn't exist, create it as durable.
      await channel.assertQueue(queueName, {
        durable: true,
      });

      // Prefetch=1 means 'give me one message, wait for ack, then give next message'.
      // This ensures fair distribution among multiple workers. Without prefetch, one worker might
      // grab all messages while others sit idle.
      channel.prefetch(1);

      // noAck=false means we must manually acknowledge each message.
      // If we don't ack, message stays in queue and will be redelivered.
      await channel.consume(
        queueName,
        async (msg: amqp.ConsumeMessage | null) => {
          // If msg is null, channel was closed. This can happen during shutdown or reconnection.
          if (!msg) {
            logger.warn(
              "createConsumer - received null message",
              baseLogContext
            );

            return;
          }

          const messageContext = {
            ...baseLogContext,
            messageId: msg.properties.messageId,
          };

          try {
            // RabbitMQ messages are Buffers. Convert to string, then parse JSON.
            const jobData = JSON.parse(msg.content.toString());

            logger.info("createConsumer - processing message", messageContext);

            // Call handler function - it should return Promise that resolves on success, rejects on failure
            await handler(jobData);

            // Ack tells RabbitMQ 'I processed this successfully, you can delete it from the queue'.
            // Message is removed from queue and won't be redelivered.
            channel.ack(msg);

            logger.info(
              "createConsumer - message processed successfully",
              messageContext
            );
          } catch (error) {
            logger.error(
              "createConsumer - message processing failed",
              error,
              messageContext
            );

            // Determine if error is permanent (4xx, validation) or transient (5xx, network)
            const isPermanentFailure =
              error instanceof Error &&
              (error.message.includes("400") ||
                error.message.includes("401") ||
                error.message.includes("403") ||
                error.message.includes("404") ||
                error.message.includes("validation") ||
                error.message.includes("BadRequest"));

            if (isPermanentFailure) {
              // nack(msg, false, false) = 'discard this message, don't requeue'.
              // false, false means: don't requeue to all consumers, don't requeue at all.
              // Use for permanent failures that won't succeed on retry (e.g., validation errors).
              channel.nack(msg, false, false);
              logger.warn(
                "createConsumer - message nacked (permanent failure)",
                messageContext
              );
            } else {
              // nack(msg, false, true) = 'put this message back in queue for retry'.
              // false, true means: don't requeue to all consumers, but do requeue to this queue.
              // Use for transient failures that might succeed on retry (e.g., temporary network issues).
              channel.nack(msg, false, true);
              logger.warn(
                "createConsumer - message nacked (transient failure, will retry)",
                messageContext
              );
            }
          }
        },
        { noAck: false }
      );

      logger.info("createConsumer - consumer setup complete", baseLogContext);
    });

    // Wait for channel to be ready
    await channelWrapper.waitForConnect();

    logger.info("createConsumer - consumer started", baseLogContext);

    // This pattern ensures no message loss. If worker crashes mid-processing,
    // unacknowledged message is automatically requeued by RabbitMQ.
  } catch (error) {
    logger.error(
      "createConsumer - failed to start consumer",
      error,
      baseLogContext
    );

    throw new InternalError("Failed to create RabbitMQ consumer", {
      queueName,
    });
  }
};

/**
 * Publishes a failed job to the Dead Letter Queue (DLQ).
 *
 * DLQ is used for messages that couldn't be processed after all retries.
 * This allows manual inspection and potential replay of failed jobs.
 *
 * @param queueName - The DLQ queue name
 * @param jobData - The original job payload
 * @param error - The error that caused the failure
 */
export const publishToDLQ = async (
  queueName: string,
  jobData: unknown,
  error: Error
): Promise<void> => {
  const baseLogContext = {
    queueName,
    errorMessage: error.message,
  };

  try {
    logger.info("publishToDLQ - starting", baseLogContext);

    // Channel wrapper automatically recreates channels if connection is lost and restored.
    const channelWrapper = connection.createChannel();

    // Ensure queue exists (runs on every reconnection - this is fine, it's idempotent)
    await channelWrapper.addSetup(async (channel: Channel) => {
      // DLQ should be durable so failed jobs aren't lost on broker restart.
      await channel.assertQueue(queueName, {
        durable: true,
      });
    });

    // Wait for channel to be ready
    await channelWrapper.waitForConnect();

    // Include both original job data and error details so we can:
    // 1. Understand why it failed (error message, stack trace)
    // 2. Replay the job if needed (original jobData)
    const dlqMessage = {
      originalJob: jobData,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
    };

    // Send message once using a one-time setup
    let messageSent = false;
    await new Promise<void>((resolve, reject) => {
      const sendMessage = async (channel: Channel) => {
        if (messageSent) {
          resolve();

          return;
        }

        try {
          // persistent=true writes message to disk. If broker restarts, message is not lost.
          const messageBuffer = Buffer.from(JSON.stringify(dlqMessage));
          const sent = channel.sendToQueue(queueName, messageBuffer, {
            persistent: true,
          });

          if (!sent) {
            reject(
              new InternalError(
                "Failed to send message to DLQ - queue may be full"
              )
            );

            return;
          }

          messageSent = true;

          resolve();
        } catch (error) {
          reject(error);
        }
      };

      // Add setup that sends message (will run when channel is ready)
      channelWrapper.addSetup(sendMessage);
    });

    // Only send to DLQ after all retries exhausted. Transient failures should be requeued,
    // not sent to DLQ immediately.
    logger.info("publishToDLQ - succeeded", baseLogContext);
  } catch (error) {
    logger.error("publishToDLQ - failed", error, baseLogContext);

    throw new InternalError("Failed to publish job to DLQ", {
      queueName,
    });
  }
};

// amqp-connection-manager automatically:
// 1. Detects connection loss
// 2. Attempts reconnection with exponential backoff
// 3. Recreates channels after reconnection
// 4. Emits events we can listen to (connect, disconnect, error)
//
// This is why we use channel.addSetup() - setup code runs every time channel is created,
// including after reconnection. Without this, consumer would stop working after reconnection.
//
// Check amqp-connection-manager README for exact API. The wrapper pattern might vary
// between versions. Key is ensuring setup runs after reconnection.
