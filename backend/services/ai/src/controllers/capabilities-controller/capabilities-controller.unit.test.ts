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
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";
import { getCapabilityValidatedQuery } from "@utils/get-capability-validated-query";

vi.mock("@utils/get-capability-config", () => ({
  getCapabilityConfig: vi.fn(),
}));

vi.mock("@utils/get-capability-validated-input", () => ({
  getCapabilityValidatedInput: vi.fn(),
}));

vi.mock("@utils/get-capability-validated-query", () => ({
  getCapabilityValidatedQuery: vi.fn(),
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

  let mockedGetCapabilityConfig: Mocked<typeof getCapabilityConfig>;
  let mockedGetCapabilityValidatedInput: Mocked<
    typeof getCapabilityValidatedInput
  >;
  let mockedGetCapabilityValidatedQuery: Mocked<
    typeof getCapabilityValidatedQuery
  >;
  let mockedGetPatternExecutor: Mocked<typeof getPatternExecutor>;
  let mockPatternExecutor: ReturnType<typeof vi.fn>;

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    mockedGetCapabilityConfig = vi.mocked(getCapabilityConfig);
    mockedGetCapabilityConfig.mockReturnValue(mockParseTaskCapabilityConfig);

    mockedGetCapabilityValidatedInput = vi.mocked(getCapabilityValidatedInput);
    mockedGetCapabilityValidatedInput.mockReturnValue(
      mockParseTaskValidatedInput as any
    );

    mockedGetCapabilityValidatedQuery = vi.mocked(getCapabilityValidatedQuery);
    mockedGetCapabilityValidatedQuery.mockReturnValue({
      pattern: CAPABILITY_PATTERN.SYNC,
    });

    mockPatternExecutor = vi.fn().mockResolvedValue(mockExecutorResult);
    mockedGetPatternExecutor = vi.mocked(getPatternExecutor);
    mockedGetPatternExecutor.mockReturnValue(mockPatternExecutor);

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

  it("should call executor with validated input and respond with result", async () => {
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
    expect(mockNextFunction).not.toHaveBeenCalled();
  });

  it("should pass executor errors to next", async () => {
    const mockError = new Error("failure");
    mockPatternExecutor.mockRejectedValue(mockError);

    await executeCapability(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockNextFunction).toHaveBeenCalledWith(mockError);
  });
});
