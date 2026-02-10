import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { RABBITMQ_QUEUE } from "@constants";
import { executeCapability } from "@controllers/capabilities-controller/capabilities-controller";
import { mockCallbackUrl } from "@mocks/callbackUrl-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { Mocked } from "@shared/types";
import { getCapabilityConfig } from "@utils/get-capability-config";
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";
import { getCapabilityValidatedQuery } from "@utils/get-capability-validated-query";

const { mockSendMessageToRabbitMQQueue } = vi.hoisted(() => ({
  mockSendMessageToRabbitMQQueue: vi.fn(),
}));
vi.mock("@clients/rabbitmq", () => ({
  sendMessageToRabbitMQQueue: mockSendMessageToRabbitMQQueue,
}));

vi.mock("@config/env", () => ({
  env: {},
}));

vi.mock("@utils/get-capability-config", () => ({
  getCapabilityConfig: vi.fn(),
}));

vi.mock("@utils/get-capability-validated-input", () => ({
  getCapabilityValidatedInput: vi.fn(),
}));

vi.mock("@utils/get-capability-validated-query", () => ({
  getCapabilityValidatedQuery: vi.fn(),
}));

describe("capabilitiesController (unit)", () => {
  let mockedSendMessageToRabbitMQQueue: Mocked<
    typeof mockSendMessageToRabbitMQQueue
  >;
  let mockedGetCapabilityConfig: Mocked<typeof getCapabilityConfig>;
  let mockedGetCapabilityValidatedInput: Mocked<
    typeof getCapabilityValidatedInput
  >;
  let mockedGetCapabilityValidatedQuery: Mocked<
    typeof getCapabilityValidatedQuery
  >;

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockedSendMessageToRabbitMQQueue = vi.mocked(
      mockSendMessageToRabbitMQQueue
    );
    mockedSendMessageToRabbitMQQueue.mockResolvedValue(undefined);

    mockedGetCapabilityConfig = vi.mocked(getCapabilityConfig);
    mockedGetCapabilityConfig.mockReturnValue(mockParseTaskCapabilityConfig);

    mockedGetCapabilityValidatedInput = vi.mocked(getCapabilityValidatedInput);
    mockedGetCapabilityValidatedInput.mockReturnValue(
      mockParseTaskValidatedInput as any
    );

    mockedGetCapabilityValidatedQuery = vi.mocked(getCapabilityValidatedQuery);
    mockedGetCapabilityValidatedQuery.mockReturnValue({
      callbackUrl: mockCallbackUrl,
    });

    mockRequest = {};
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should send message to RabbitMQ queue and respond with accepted status", async () => {
    await executeCapability(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockedGetCapabilityConfig).toHaveBeenCalledWith(
      mockResponse as Response
    );
    expect(mockedGetCapabilityValidatedInput).toHaveBeenCalledWith(
      mockResponse as Response
    );
    expect(mockedGetCapabilityValidatedQuery).toHaveBeenCalledWith(
      mockResponse as Response
    );
    expect(mockedSendMessageToRabbitMQQueue).toHaveBeenCalledWith(
      RABBITMQ_QUEUE.CAPABILITIES,
      {
        requestId: mockAiServiceRequestId,
        capability: mockParseTaskCapabilityConfig.name,
        input: mockParseTaskValidatedInput,
        callbackUrl: mockCallbackUrl,
        startTime: expect.any(Number),
      }
    );
    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.ACCEPTED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: "The request has been received and will be executed shortly.",
      aiServiceRequestId: mockAiServiceRequestId,
    });
    expect(mockNextFunction).not.toHaveBeenCalled();
  });

  it("should pass RabbitMQ errors to next", async () => {
    const mockError = new Error("RabbitMQ failure");
    mockedSendMessageToRabbitMQQueue.mockRejectedValue(mockError);

    await executeCapability(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockNextFunction).toHaveBeenCalledWith(mockError);
  });
});
