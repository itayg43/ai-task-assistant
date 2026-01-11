import * as amqp from "amqplib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockCallbackUrl,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { AI_ERROR_TYPE, CAPABILITY, RABBITMQ_QUEUE } from "@constants";
import {
  createMockChannel,
  createMockMessage,
  setupConsumeWithMessage,
} from "@mocks/rabbitmq-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { InternalError } from "@shared/errors";
import { consumeCapabilitiesMessage } from "./capabilities-worker";

const {
  mockGetRabbitMQChannel,
  mockExecuteSyncPattern,
  mockWithRetry,
  mockCapabilities,
  mockExtractErrorInfo,
} = vi.hoisted(() => ({
  mockGetRabbitMQChannel: vi.fn(),
  mockExecuteSyncPattern: vi.fn(),
  mockWithRetry: vi.fn(),
  mockCapabilities: {
    "parse-task": {
      name: "parse-task",
      inputSchema: {
        parse: vi.fn((input) => input),
      },
    },
  },
  mockExtractErrorInfo: vi.fn(),
}));

vi.mock("@clients/rabbitmq", () => ({
  getRabbitMQChannel: mockGetRabbitMQChannel,
}));

vi.mock(
  "@controllers/capabilities-controller/executors/execute-sync-pattern",
  () => ({
    executeSyncPattern: mockExecuteSyncPattern,
  })
);

vi.mock("@shared/utils/with-retry", () => ({
  withRetry: mockWithRetry,
}));

vi.mock("@shared/utils/extract-error-info", () => ({
  extractErrorInfo: mockExtractErrorInfo,
}));

vi.mock("@capabilities", () => ({
  capabilities: mockCapabilities,
}));

describe("capabilitiesWorker", () => {
  let mockChannel: amqp.Channel;
  let mockMessage: amqp.ConsumeMessage;

  beforeEach(() => {
    // Create a mock RabbitMQ message with test data
    mockMessage = createMockMessage({
      requestId: mockAiServiceRequestId,
      capability: CAPABILITY.PARSE_TASK,
      input: mockParseTaskValidatedInput,
      callbackUrl: mockCallbackUrl,
    });

    // Create a mock channel that will deliver mockMessage when consume() is called
    // The createMockChannel function sets up channel.consume() to immediately
    // invoke the handler with mockMessage (see rabbitmq-mocks.ts)
    mockChannel = createMockChannel(mockMessage);

    // Configure the mock to return our mockChannel when getRabbitMQChannel is called
    mockGetRabbitMQChannel.mockResolvedValue(mockChannel);

    mockExecuteSyncPattern.mockResolvedValue({
      message: "success",
    });

    mockWithRetry.mockImplementation(async (_config, fn) => {
      return await fn();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("consumeCapabilitiesMessage", () => {
    it("should initialize RabbitMQ consumer with prefetch(1) and manual acknowledgment", async () => {
      await consumeCapabilitiesMessage();

      expect(mockGetRabbitMQChannel).toHaveBeenCalledWith(
        RABBITMQ_QUEUE.CAPABILITIES
      );
      expect(mockChannel.prefetch).toHaveBeenCalledWith(1);
      expect(mockChannel.consume).toHaveBeenCalledWith(
        RABBITMQ_QUEUE.CAPABILITIES,
        expect.any(Function),
        {
          noAck: false,
        }
      );
    });

    it("should handle null message gracefully", async () => {
      setupConsumeWithMessage(mockChannel, null);

      await consumeCapabilitiesMessage();

      // Should not throw, just return early
      expect(mockChannel.consume).toHaveBeenCalled();
    });

    it("should throw InternalError when getRabbitMQChannel fails", async () => {
      const channelError = new Error("Failed to get channel");
      mockGetRabbitMQChannel.mockRejectedValue(channelError);

      await expect(consumeCapabilitiesMessage()).rejects.toMatchObject({
        message: expect.any(String),
        context: {
          type: AI_ERROR_TYPE.RABBITMQ_CONSUME_MESSAGE_FAILED,
        },
      });
    });
  });

  describe("capabilitiesMessageHandler", () => {
    it("should parse message payload using schema", async () => {
      await consumeCapabilitiesMessage();

      // This test verifies that the worker correctly:
      // 1. Parses the raw message content (JSON.parse)
      // 2. Validates it against capabilitiesQueueMessageDataSchema
      // 3. Validates the input using the capability's inputSchema.parse()
      // 4. Passes the validated input to executeSyncPattern
      //
      // We check the exact validated input to ensure the validation step
      // (config.inputSchema.parse(input)) was executed correctly.
      expect(mockExecuteSyncPattern).toHaveBeenCalledWith(
        mockAiServiceRequestId,
        expect.objectContaining({
          name: CAPABILITY.PARSE_TASK,
        }),
        mockParseTaskValidatedInput
      );
    });

    it("should get capability config from registry", async () => {
      await consumeCapabilitiesMessage();

      // This test verifies that the worker correctly:
      // 1. Retrieves the capability config from the capabilities registry
      //    (capabilities[capability] lookup)
      // 2. Passes the complete config object to executeSyncPattern
      //
      // We use expect.any(Object) for input because this test focuses on
      // config retrieval, not input validation (which is tested above).
      // We verify the config has the correct capability name to ensure
      // the registry lookup worked correctly.
      expect(mockExecuteSyncPattern).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: CAPABILITY.PARSE_TASK,
        }),
        expect.any(Object)
      );
    });

    it("should handle capability execution errors", async () => {
      const executionError = new InternalError("Execution failed");
      mockExecuteSyncPattern.mockRejectedValue(executionError);

      await consumeCapabilitiesMessage();

      expect(mockWithRetry).toHaveBeenCalledWith(
        DEFAULT_RETRY_CONFIG,
        expect.any(Function),
        {
          operation: "sendErrorCallback",
        }
      );
    });
  });

  describe("callback handler acknowledgment behavior", () => {
    it("should acknowledge message after successful callback retry operation", async () => {
      await consumeCapabilitiesMessage();

      expect(mockChannel.ack).toHaveBeenCalledTimes(1);
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it("should nack message without requeue when callback retry operation exhausts all retries", async () => {
      mockWithRetry.mockRejectedValue(new InternalError("Callback failed"));

      await consumeCapabilitiesMessage();

      expect(mockChannel.nack).toHaveBeenCalledTimes(1);
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });
  });
});
