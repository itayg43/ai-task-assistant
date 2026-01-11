import * as amqp from "amqplib";
import { vi } from "vitest";

/**
 * Creates a mock implementation for channel.consume that handles a message.
 * @param message - The message to handle when consume is called
 * @returns The mock implementation function
 */
const createConsumeMockImplementation = (
  message: amqp.ConsumeMessage | null
) => {
  return async (
    _queue: string,
    handler: (msg: amqp.ConsumeMessage | null) => void | Promise<void>,
    _options: amqp.Options.Consume
  ) => {
    const result = handler(message);
    // Await the handler if it returns a Promise, otherwise wait for next tick
    if (result instanceof Promise) {
      await result;
    } else {
      await Promise.resolve();
    }
    return {
      consumerTag: "test-tag",
    } as amqp.Replies.Consume;
  };
};

/**
 * Creates a mock RabbitMQ channel with all necessary methods.
 * @param messageToHandle - Optional message to handle when consume is called. Defaults to null.
 * @returns A mock amqp.Channel object
 */
export const createMockChannel = (
  messageToHandle: amqp.ConsumeMessage | null = null
): amqp.Channel => {
  const channel = {
    // The real implementation is async
    prefetch: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn(),
    ack: vi.fn(),
    nack: vi.fn(),
  } as unknown as amqp.Channel;

  (channel.consume as ReturnType<typeof vi.fn>).mockImplementation(
    createConsumeMockImplementation(messageToHandle)
  );

  return channel;
};

/**
 * Sets up a channel's consume method to handle a specific message.
 * Useful for testing different message scenarios.
 * @param channel - The mock channel to configure
 * @param message - The message to handle when consume is called
 */
export const setupConsumeWithMessage = (
  channel: amqp.Channel,
  message: amqp.ConsumeMessage | null
) => {
  channel.consume = vi.fn();

  (channel.consume as ReturnType<typeof vi.fn>).mockImplementation(
    createConsumeMockImplementation(message)
  );
};

/**
 * Creates a mock RabbitMQ consume message with the provided payload.
 * @param payload - The message payload to serialize as JSON
 * @returns A mock amqp.ConsumeMessage object
 */
export const createMockMessage = (
  payload: Record<string, unknown>
): amqp.ConsumeMessage => {
  return {
    content: Buffer.from(JSON.stringify(payload)),
  } as unknown as amqp.ConsumeMessage;
};
