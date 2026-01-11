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
import { consumeCapabilitiesMessage } from "@workers/capabilities-worker";

const {
  mockGetRabbitMQChannel,
  mockExecuteSyncPattern,
  mockWithRetry,
  mockCapabilities,
  mockExtractErrorInfo,
  mockTasksClient,
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
  mockTasksClient: {
    post: vi.fn(),
  },
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

vi.mock("@clients/tasks", () => ({
  tasksClient: mockTasksClient,
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
    it("should parse message payload, validate input, and execute capability", async () => {
      await consumeCapabilitiesMessage();

      // This test verifies that the worker correctly:
      // 1. Parses the raw message content (JSON.parse)
      // 2. Validates it against capabilitiesQueueMessageDataSchema
      // 3. Retrieves the capability config from the capabilities registry
      // 4. Validates the input using the capability's inputSchema.parse()
      // 5. Passes the validated input and config to executeSyncPattern
      expect(mockExecuteSyncPattern).toHaveBeenCalledWith(
        mockAiServiceRequestId,
        expect.objectContaining({
          name: CAPABILITY.PARSE_TASK,
        }),
        mockParseTaskValidatedInput
      );
    });

    it("should nack message when JSON parsing fails", async () => {
      const invalidJsonMessage = {
        content: Buffer.from("invalid json{"),
      } as unknown as amqp.ConsumeMessage;

      setupConsumeWithMessage(mockChannel, invalidJsonMessage);

      await consumeCapabilitiesMessage();

      expect(mockChannel.nack).toHaveBeenCalledTimes(1);
      expect(mockChannel.nack).toHaveBeenCalledWith(
        invalidJsonMessage,
        false,
        false
      );
      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockExecuteSyncPattern).not.toHaveBeenCalled();
    });

    it("should nack message when schema validation fails", async () => {
      const invalidSchemaMessage = createMockMessage({
        requestId: mockAiServiceRequestId,
        capability: "invalid-capability",
        input: mockParseTaskValidatedInput,
        callbackUrl: mockCallbackUrl,
      });

      setupConsumeWithMessage(mockChannel, invalidSchemaMessage);

      await consumeCapabilitiesMessage();

      expect(mockChannel.nack).toHaveBeenCalledTimes(1);
      expect(mockChannel.nack).toHaveBeenCalledWith(
        invalidSchemaMessage,
        false,
        false
      );
      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockExecuteSyncPattern).not.toHaveBeenCalled();
    });

    it("should handle capability not found error", async () => {
      // Create a message with a valid capability enum value
      // but the capability won't exist in the mock registry
      const unknownCapabilityMessage = createMockMessage({
        requestId: mockAiServiceRequestId,
        capability: CAPABILITY.PARSE_TASK,
        input: mockParseTaskValidatedInput,
        callbackUrl: mockCallbackUrl,
      });

      // Temporarily replace the capabilities mock to simulate missing capability
      const originalCapabilities = {
        ...mockCapabilities,
      };
      // Clear the capabilities object to simulate capability not found
      Object.keys(mockCapabilities).forEach((key) => {
        delete (mockCapabilities as Record<string, unknown>)[key];
      });

      setupConsumeWithMessage(mockChannel, unknownCapabilityMessage);
      mockExtractErrorInfo.mockReturnValue({
        status: 400,
        message: "Capability parse-task not found",
      });

      await consumeCapabilitiesMessage();

      // Restore capabilities for other tests
      Object.assign(mockCapabilities, originalCapabilities);

      expect(mockExtractErrorInfo).toHaveBeenCalled();
      expect(mockWithRetry).toHaveBeenCalledWith(
        DEFAULT_RETRY_CONFIG,
        expect.any(Function),
        {
          operation: "sendErrorCallbackHandler",
        }
      );
    });
  });

  describe("sendSuccessCallbackHandler", () => {
    it("should send success callback with correct payload and acknowledge message", async () => {
      const mockResult = {
        message: "success",
      };
      mockExecuteSyncPattern.mockResolvedValue(mockResult);

      await consumeCapabilitiesMessage();

      expect(mockTasksClient.post).toHaveBeenCalledWith(mockCallbackUrl, {
        success: true,
        result: mockResult,
        aiServiceRequestId: mockAiServiceRequestId,
      });
      expect(mockChannel.ack).toHaveBeenCalledTimes(1);
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it("should nack message when callback fails after retries", async () => {
      mockWithRetry.mockRejectedValue(new InternalError("Callback failed"));

      await consumeCapabilitiesMessage();

      expect(mockChannel.nack).toHaveBeenCalledTimes(1);
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });
  });

  describe("sendErrorCallbackHandler", () => {
    it("should send error callback with correct payload and acknowledge message when execution fails", async () => {
      const executionError = new InternalError("Execution failed");
      mockExecuteSyncPattern.mockRejectedValue(executionError);
      const mockErrorInfo = {
        status: 500,
        message: "Execution failed",
      };
      mockExtractErrorInfo.mockReturnValue(mockErrorInfo);

      await consumeCapabilitiesMessage();

      expect(mockExtractErrorInfo).toHaveBeenCalledWith(executionError);
      expect(mockWithRetry).toHaveBeenCalledWith(
        DEFAULT_RETRY_CONFIG,
        expect.any(Function),
        {
          operation: "sendErrorCallbackHandler",
        }
      );
      expect(mockTasksClient.post).toHaveBeenCalledWith(mockCallbackUrl, {
        success: false,
        error: mockErrorInfo,
        aiServiceRequestId: mockAiServiceRequestId,
      });
      expect(mockChannel.ack).toHaveBeenCalledTimes(1);
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it("should nack message when error callback fails after retries", async () => {
      const executionError = new InternalError("Execution failed");
      mockExecuteSyncPattern.mockRejectedValue(executionError);
      mockExtractErrorInfo.mockReturnValue({
        status: 500,
        message: "Execution failed",
      });
      mockWithRetry.mockRejectedValue(new InternalError("Callback failed"));

      await consumeCapabilitiesMessage();

      expect(mockChannel.nack).toHaveBeenCalledTimes(1);
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });
  });
});
