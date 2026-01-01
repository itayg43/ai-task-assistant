import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { RABBITMQ_QUEUE } from "@constants";
import { publishJob } from "@clients/rabbitmq";
import { executeAsyncPattern } from "@controllers/capabilities-controller/executors/execute-async-pattern";
import { mockOpenaiDurationMs } from "@mocks/openai-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { BadRequestError, InternalError } from "@shared/errors";
import { Mocked } from "@shared/types";
import { withDurationAsync } from "@shared/utils/with-duration";
import { CapabilityConfig } from "@types";

vi.mock("@shared/utils/with-duration", () => ({
  withDurationAsync: vi.fn(),
}));

vi.mock("@clients/rabbitmq", () => ({
  publishJob: vi.fn(),
}));

vi.mock("@config/env", () => ({
  env: {
    SERVICE_NAME: "test-service",
    SERVICE_PORT: 3000,
    RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
    TASKS_SERVICE_BASE_URL: "http://localhost:3001",
  },
}));

describe("executeAsyncPattern", () => {
  let mockedWithDurationAsync: Mocked<typeof withDurationAsync>;
  let mockedPublishJob: Mocked<typeof publishJob>;
  let mockConfig: CapabilityConfig<any, any>;

  const mockCallbackUrl = "http://localhost:3001/api/v1/webhooks";
  const mockUserId = 1;
  const mockTokenReservation = {
    tokensReserved: 1000,
    windowStartTimestamp: Date.now(),
  };

  const createMockAsyncInput = () => ({
    ...mockParseTaskValidatedInput,
    body: {
      ...mockParseTaskValidatedInput.body,
      callbackUrl: mockCallbackUrl,
      userId: mockUserId,
      tokenReservation: mockTokenReservation,
    },
  });

  beforeEach(() => {
    mockConfig = mockParseTaskCapabilityConfig;

    mockedWithDurationAsync = vi.mocked(withDurationAsync);
    mockedWithDurationAsync.mockImplementation(async (callback) => {
      const result = await callback();

      return {
        result,
        durationMs: mockOpenaiDurationMs,
      };
    });

    mockedPublishJob = vi.mocked(publishJob);
    mockedPublishJob.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should publish job to RabbitMQ with correct payload", async () => {
    const mockInput = createMockAsyncInput();

    const result = await executeAsyncPattern(
      mockConfig,
      mockInput,
      mockAiServiceRequestId
    );

    expect(withDurationAsync).toHaveBeenCalled();
    expect(publishJob).toHaveBeenCalledWith(
      RABBITMQ_QUEUE.AI_CAPABILITY_JOBS,
      {
        capability: mockInput.params.capability,
        input: mockInput,
        callbackUrl: mockCallbackUrl,
        requestId: mockAiServiceRequestId,
        userId: mockUserId,
        tokenReservation: mockTokenReservation,
      }
    );
    expect(result).toEqual({
      result: {},
      durationMs: mockOpenaiDurationMs,
    });
  });

  it.each([
    {
      description: "when body is missing",
      setup: () => ({
        ...mockParseTaskValidatedInput,
        body: undefined,
      }) as any,
    },
    {
      description: "when callbackUrl is missing",
      setup: () => ({
        ...mockParseTaskValidatedInput,
        body: {
          ...mockParseTaskValidatedInput.body,
          userId: mockUserId,
          tokenReservation: mockTokenReservation,
        },
      }),
    },
    {
      description: "when userId is missing",
      setup: () => ({
        ...mockParseTaskValidatedInput,
        body: {
          ...mockParseTaskValidatedInput.body,
          callbackUrl: mockCallbackUrl,
          tokenReservation: mockTokenReservation,
        },
      }),
    },
    {
      description: "when userId is null",
      setup: () => ({
        ...mockParseTaskValidatedInput,
        body: {
          ...mockParseTaskValidatedInput.body,
          callbackUrl: mockCallbackUrl,
          userId: null,
          tokenReservation: mockTokenReservation,
        },
      }),
    },
    {
      description: "when tokenReservation is missing",
      setup: () => ({
        ...mockParseTaskValidatedInput,
        body: {
          ...mockParseTaskValidatedInput.body,
          callbackUrl: mockCallbackUrl,
          userId: mockUserId,
        },
      }),
    },
  ])(
    "should throw BadRequestError $description",
    async ({ setup }) => {
      const mockInput = setup();

      await expect(
        executeAsyncPattern(mockConfig, mockInput, mockAiServiceRequestId)
      ).rejects.toThrow(BadRequestError);

      expect(publishJob).not.toHaveBeenCalled();
    }
  );

  it("should throw InternalError when capability is missing in params", async () => {
    const mockInput = {
      ...createMockAsyncInput(),
      params: {},
    };

    await expect(
      executeAsyncPattern(mockConfig, mockInput, mockAiServiceRequestId)
    ).rejects.toThrow(InternalError);

    expect(publishJob).not.toHaveBeenCalled();
  });

  it("should throw InternalError when publishJob fails", async () => {
    const mockInput = createMockAsyncInput();
    const mockError = new Error("RabbitMQ connection failed");

    mockedPublishJob.mockRejectedValue(mockError);

    await expect(
      executeAsyncPattern(mockConfig, mockInput, mockAiServiceRequestId)
    ).rejects.toThrow(InternalError);

    expect(publishJob).toHaveBeenCalled();
  });
});

