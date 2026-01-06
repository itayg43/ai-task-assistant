import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskOutput,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY_PATTERN } from "@constants";
import { executeCapability } from "@controllers/capabilities-controller/capabilities-controller";
import { getPatternExecutor } from "@controllers/capabilities-controller/executors/get-pattern-executor";
import {
  mockOpenaiDurationMs,
  mockOpenaiResponseId,
  mockOpenaiTokenUsage,
} from "@mocks/openai-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { Mocked } from "@shared/types";
import { getCapabilityConfig } from "@utils/get-capability-config";
import { getCapabilityPattern } from "@utils/get-capability-pattern";
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";

vi.mock("@utils/get-capability-config", () => ({
  getCapabilityConfig: vi.fn(),
}));

vi.mock("@utils/get-capability-pattern", () => ({
  getCapabilityPattern: vi.fn(),
}));

vi.mock("@utils/get-capability-validated-input", () => ({
  getCapabilityValidatedInput: vi.fn(),
}));

vi.mock(
  "@controllers/capabilities-controller/executors/get-pattern-executor",
  () => ({
    getPatternExecutor: vi.fn(),
  })
);

describe("capabilitiesController (unit)", () => {
  const mockExecutorResult = {
    openaiMetadata: {
      responseId: mockOpenaiResponseId,
      tokens: mockOpenaiTokenUsage,
      durationMs: mockOpenaiDurationMs,
    },
    result: mockParseTaskOutput,
  };

  let mockPatternExecutor: ReturnType<typeof vi.fn>;
  let mockResponse: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;
  let mockedGetCapabilityConfig: Mocked<typeof getCapabilityConfig>;
  let mockedGetCapabilityPattern: Mocked<typeof getCapabilityPattern>;
  let mockedGetCapabilityValidatedInput: Mocked<
    typeof getCapabilityValidatedInput
  >;
  let mockedGetPatternExecutor: Mocked<typeof getPatternExecutor>;

  const createMockResponse = () => ({
    locals: {
      requestId: mockAiServiceRequestId,
      capabilityPattern: CAPABILITY_PATTERN.SYNC,
    },
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  });

  beforeEach(() => {
    mockPatternExecutor = vi.fn().mockResolvedValue(mockExecutorResult);

    mockedGetCapabilityConfig = vi.mocked(getCapabilityConfig);
    mockedGetCapabilityConfig.mockReturnValue(mockParseTaskCapabilityConfig);

    mockedGetCapabilityPattern = vi.mocked(getCapabilityPattern);
    mockedGetCapabilityPattern.mockReturnValue(CAPABILITY_PATTERN.SYNC);

    mockedGetCapabilityValidatedInput = vi.mocked(getCapabilityValidatedInput);
    mockedGetCapabilityValidatedInput.mockReturnValue(
      mockParseTaskValidatedInput as any
    );

    mockedGetPatternExecutor = vi.mocked(getPatternExecutor);
    mockedGetPatternExecutor.mockReturnValue(mockPatternExecutor);

    mockResponse = createMockResponse();
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call executor with validated input and respond with result", async () => {
    await executeCapability({} as Request, mockResponse as Response, mockNext);

    expect(mockedGetCapabilityConfig).toHaveBeenCalledWith(
      mockResponse as Response
    );
    expect(mockedGetCapabilityPattern).toHaveBeenCalledWith(
      mockResponse as Response
    );
    expect(mockedGetCapabilityValidatedInput).toHaveBeenCalledWith(
      mockResponse as Response
    );
    expect(mockedGetPatternExecutor).toHaveBeenCalledWith(
      CAPABILITY_PATTERN.SYNC
    );
    expect(mockPatternExecutor).toHaveBeenCalledWith(
      mockParseTaskCapabilityConfig,
      mockParseTaskValidatedInput,
      mockAiServiceRequestId
    );
    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(mockResponse.json).toHaveBeenCalledWith({
      ...mockExecutorResult,
      aiServiceRequestId: mockAiServiceRequestId,
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should pass executor errors to next", async () => {
    const mockError = new Error("failure");
    mockPatternExecutor.mockRejectedValue(mockError);

    await executeCapability({} as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(mockError);
  });
});
