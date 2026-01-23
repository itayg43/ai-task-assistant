import * as amqp from "amqplib";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import {
  closeRabbitMQClient,
  connectRabbitMQClient,
  getRabbitMQChannel,
  getRabbitMQConnection,
  sendMessageToRabbitMQQueue,
} from "@clients/rabbitmq/rabbitmq";
import { CAPABILITY, RABBITMQ_QUEUE } from "@constants";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { ServiceUnavailableError } from "@shared/errors";
import { CapabilitiesQueueMessageData } from "@types";

const { mockCreateRabbitMQConnection, mockCloseRabbitMQConnection, mockEnv } =
  vi.hoisted(() => ({
    mockCreateRabbitMQConnection: vi.fn(),
    mockCloseRabbitMQConnection: vi.fn(),
    mockEnv: {
      RABBITMQ_URL: "amqp://user:password@localhost:5672",
    },
  }));

vi.mock("@shared/clients/rabbitmq", () => ({
  createRabbitMQConnection: mockCreateRabbitMQConnection,
  closeRabbitMQConnection: mockCloseRabbitMQConnection,
}));

vi.mock("@config/env", () => ({
  env: mockEnv,
}));

describe("rabbitmq", () => {
  let mockConnection: amqp.ChannelModel;
  let mockChannel: amqp.Channel;

  beforeEach(() => {
    mockChannel = {
      assertQueue: vi.fn().mockResolvedValue(undefined),
      sendToQueue: vi.fn().mockReturnValue(true),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    } as unknown as amqp.Channel;

    mockConnection = {
      createChannel: vi.fn().mockResolvedValue(mockChannel),
    } as unknown as amqp.ChannelModel;

    mockCreateRabbitMQConnection.mockResolvedValue(mockConnection);
    mockCloseRabbitMQConnection.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    // Clean up global state
    try {
      await closeRabbitMQClient();
    } catch {
      // Ignore errors if not initialized
    }
  });

  describe("connectRabbitMQClient", () => {
    it("should create RabbitMQ connection", async () => {
      await connectRabbitMQClient();

      expect(mockCreateRabbitMQConnection).toHaveBeenCalledWith(
        mockEnv.RABBITMQ_URL,
      );
    });

    it("should store connection globally", async () => {
      await connectRabbitMQClient();

      const connection = getRabbitMQConnection();
      expect(connection).toBe(mockConnection);
    });
  });

  describe("closeRabbitMQClient", () => {
    it("should close channel and connection", async () => {
      await connectRabbitMQClient();
      // Create channel by calling getRabbitMQChannel
      await getRabbitMQChannel(RABBITMQ_QUEUE.CAPABILITIES);
      await closeRabbitMQClient();

      expect(mockChannel.close).toHaveBeenCalledTimes(1);
      expect(mockCloseRabbitMQConnection).toHaveBeenCalledWith(mockConnection);
    });

    it("should close connection even when channel is not created", async () => {
      await connectRabbitMQClient();
      // Don't create channel by calling getRabbitMQChannel
      await closeRabbitMQClient();

      expect(mockChannel.close).not.toHaveBeenCalled();
      expect(mockCloseRabbitMQConnection).toHaveBeenCalledWith(mockConnection);
    });

    it("should handle case when connection is not initialized", async () => {
      // Don't connect first
      await closeRabbitMQClient();

      expect(mockCloseRabbitMQConnection).not.toHaveBeenCalled();
    });
  });

  describe("getRabbitMQConnection", () => {
    it("should return connection when initialized", async () => {
      await connectRabbitMQClient();

      const connection = getRabbitMQConnection();

      expect(connection).toBe(mockConnection);
    });

    it("should throw error when connection is not initialized", () => {
      expect(() => getRabbitMQConnection()).toThrow(expect.any(Error));
    });
  });

  describe("getRabbitMQChannel", () => {
    it("should create channel and assert queue", async () => {
      await connectRabbitMQClient();

      const channel = await getRabbitMQChannel(RABBITMQ_QUEUE.CAPABILITIES);

      expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);

      // Verify DLQ assertion
      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        `${RABBITMQ_QUEUE.CAPABILITIES}.dlq`,
        {
          durable: true,
        },
      );

      // Verify main queue assertion with dead-letter config
      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        RABBITMQ_QUEUE.CAPABILITIES,
        {
          durable: true,
          deadLetterExchange: "",
          deadLetterRoutingKey: `${RABBITMQ_QUEUE.CAPABILITIES}.dlq`,
        },
      );
      expect(channel).toBe(mockChannel);
    });

    it("should set up error and close listeners on channel creation", async () => {
      await connectRabbitMQClient();

      await getRabbitMQChannel(RABBITMQ_QUEUE.CAPABILITIES);

      expect(mockChannel.on).toHaveBeenCalledWith(
        "error",
        expect.any(Function),
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        "close",
        expect.any(Function),
      );
    });

    it("should reuse existing channel on subsequent calls", async () => {
      await connectRabbitMQClient();

      await getRabbitMQChannel(RABBITMQ_QUEUE.CAPABILITIES);
      await getRabbitMQChannel(RABBITMQ_QUEUE.CAPABILITIES);

      expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);
      expect(mockChannel.assertQueue).toHaveBeenCalledTimes(4);
    });

    it("should assert queue with durable option and DLQ config", async () => {
      await connectRabbitMQClient();

      await getRabbitMQChannel(RABBITMQ_QUEUE.CAPABILITIES);

      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        `${RABBITMQ_QUEUE.CAPABILITIES}.dlq`,
        {
          durable: true,
        },
      );

      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        RABBITMQ_QUEUE.CAPABILITIES,
        {
          durable: true,
          deadLetterExchange: "",
          deadLetterRoutingKey: `${RABBITMQ_QUEUE.CAPABILITIES}.dlq`,
        },
      );
    });

    it("should throw error when connection is not initialized", async () => {
      await expect(
        getRabbitMQChannel(RABBITMQ_QUEUE.CAPABILITIES),
      ).rejects.toThrow(expect.any(Error));
    });
  });

  describe("sendMessageToRabbitMQQueue", () => {
    const mockMessageData: CapabilitiesQueueMessageData = {
      requestId: mockAiServiceRequestId,
      capability: CAPABILITY.PARSE_TASK,
      input: {
        naturalLanguage: "test input",
      },
      callbackUrl: "https://example.com/callback",
      startTime: 1234567890,
    };

    it("should send message to queue with correct payload", async () => {
      await connectRabbitMQClient();

      await sendMessageToRabbitMQQueue(
        RABBITMQ_QUEUE.CAPABILITIES,
        mockMessageData,
      );

      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        RABBITMQ_QUEUE.CAPABILITIES,
        Buffer.from(JSON.stringify(mockMessageData)),
        {
          persistent: true,
        },
      );
    });

    it("should use persistent message properties", async () => {
      await connectRabbitMQClient();

      await sendMessageToRabbitMQQueue(
        RABBITMQ_QUEUE.CAPABILITIES,
        mockMessageData,
      );

      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        {
          persistent: true,
        },
      );
    });

    it("should serialize message data to JSON buffer", async () => {
      await connectRabbitMQClient();

      await sendMessageToRabbitMQQueue(
        RABBITMQ_QUEUE.CAPABILITIES,
        mockMessageData,
      );

      const callArgs = (mockChannel.sendToQueue as Mock).mock.calls[0];
      const buffer = callArgs[1];
      const parsed = JSON.parse(buffer.toString());

      expect(parsed).toEqual(mockMessageData);
    });

    it("should throw error when connection is not initialized", async () => {
      await expect(
        sendMessageToRabbitMQQueue(
          RABBITMQ_QUEUE.CAPABILITIES,
          mockMessageData,
        ),
      ).rejects.toThrow(expect.any(Error));
    });

    it("should throw error when sendToQueue returns false (buffer full)", async () => {
      await connectRabbitMQClient();
      (mockChannel.sendToQueue as Mock).mockReturnValue(false);

      await expect(
        sendMessageToRabbitMQQueue(
          RABBITMQ_QUEUE.CAPABILITIES,
          mockMessageData,
        ),
      ).rejects.toThrow(ServiceUnavailableError);
    });
  });
});
