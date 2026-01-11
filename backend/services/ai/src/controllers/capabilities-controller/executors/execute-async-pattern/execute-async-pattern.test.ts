import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { AI_ERROR_TYPE, RABBITMQ_QUEUE } from "@constants";
import { executeAsyncPattern } from "@controllers/capabilities-controller/executors/execute-async-pattern";
import { mockCallbackUrl } from "@mocks/callbackUrl-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { CapabilityConfig } from "@types";

const { mockSendMessageToRabbitMQQueue } = vi.hoisted(() => ({
  mockSendMessageToRabbitMQQueue: vi.fn(),
}));

vi.mock("@clients/rabbitmq", () => ({
  sendMessageToRabbitMQQueue: mockSendMessageToRabbitMQQueue,
}));

describe("executeAsyncPattern", () => {
  let mockConfig: CapabilityConfig<any, any>;

  beforeEach(() => {
    mockSendMessageToRabbitMQQueue.mockResolvedValue(undefined);

    mockConfig = mockParseTaskCapabilityConfig;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should send message to queue and return success message", async () => {
    const result = await executeAsyncPattern(
      mockAiServiceRequestId,
      mockConfig,
      mockParseTaskValidatedInput,
      mockCallbackUrl
    );

    expect(mockSendMessageToRabbitMQQueue).toHaveBeenCalledWith(
      RABBITMQ_QUEUE.CAPABILITIES,
      {
        requestId: mockAiServiceRequestId,
        capability: mockConfig.name,
        input: mockParseTaskValidatedInput,
        callbackUrl: mockCallbackUrl,
      }
    );
    expect(result).toEqual(expect.any(String));
  });

  it("should throw ServiceUnavailableError when sendMessageToRabbitMQQueue fails", async () => {
    const queueError = new Error("Failed to send message to queue");
    mockSendMessageToRabbitMQQueue.mockRejectedValue(queueError);

    await expect(
      executeAsyncPattern(
        mockAiServiceRequestId,
        mockConfig,
        mockParseTaskValidatedInput,
        mockCallbackUrl
      )
    ).rejects.toMatchObject({
      message: expect.any(String),
      context: {
        capability: mockConfig.name,
        type: AI_ERROR_TYPE.RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED,
      },
    });
  });
});
