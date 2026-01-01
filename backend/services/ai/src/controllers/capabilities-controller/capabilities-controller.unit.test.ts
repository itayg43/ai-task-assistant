import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskCapabilityConfig } from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY_PATTERN } from "@constants";
import { executeCapability } from "@controllers/capabilities-controller/capabilities-controller";
import { getPatternExecutor } from "@controllers/capabilities-controller/executors/get-pattern-executor";
import {
  mockAsyncExecutorResult,
  mockAsyncPatternInput,
  mockSyncExecutorResult,
  mockSyncPatternInput,
} from "@mocks/capabilities-controller-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { Mocked } from "@shared/types";
import { getCapabilityConfig } from "@utils/get-capability-config";
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";

vi.mock("@utils/get-capability-config", () => ({
  getCapabilityConfig: vi.fn(),
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
  let mockPatternExecutor: ReturnType<typeof vi.fn>;
  let mockResponse: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;
  let mockedGetCapabilityConfig: Mocked<typeof getCapabilityConfig>;
  let mockedGetCapabilityValidatedInput: Mocked<
    typeof getCapabilityValidatedInput
  >;
  let mockedGetPatternExecutor: Mocked<typeof getPatternExecutor>;

  beforeEach(() => {
    mockPatternExecutor = vi.fn().mockResolvedValue(mockSyncExecutorResult);

    mockedGetCapabilityConfig = vi.mocked(getCapabilityConfig);
    mockedGetCapabilityConfig.mockReturnValue(mockParseTaskCapabilityConfig);

    mockedGetCapabilityValidatedInput = vi.mocked(getCapabilityValidatedInput);

    mockedGetPatternExecutor = vi.mocked(getPatternExecutor);
    mockedGetPatternExecutor.mockReturnValue(mockPatternExecutor);

    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("sync pattern", () => {
    beforeEach(() => {
      mockedGetCapabilityValidatedInput.mockReturnValue(
        mockSyncPatternInput as any
      );
      mockPatternExecutor.mockResolvedValue(mockSyncExecutorResult);
    });

    it("should call executor with validated input and respond with 200 OK and result", async () => {
      await executeCapability(
        {} as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedGetCapabilityConfig).toHaveBeenCalledWith(
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
        mockSyncPatternInput,
        mockAiServiceRequestId
      );
      expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockResponse.json).toHaveBeenCalledWith({
        ...mockSyncExecutorResult.result,
        aiServiceRequestId: mockAiServiceRequestId,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("async pattern", () => {
    beforeEach(() => {
      mockedGetCapabilityValidatedInput.mockReturnValue(
        mockAsyncPatternInput as any
      );
      mockPatternExecutor.mockResolvedValue(mockAsyncExecutorResult);
    });

    it("should call executor with validated input and respond with 202 Accepted without result", async () => {
      await executeCapability(
        {} as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedGetPatternExecutor).toHaveBeenCalledWith(
        CAPABILITY_PATTERN.ASYNC
      );
      expect(mockPatternExecutor).toHaveBeenCalledWith(
        mockParseTaskCapabilityConfig,
        mockAsyncPatternInput,
        mockAiServiceRequestId
      );
      expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.ACCEPTED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        aiServiceRequestId: mockAiServiceRequestId,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should pass executor errors to next", async () => {
      const mockError = new Error("failure");
      mockPatternExecutor.mockRejectedValue(mockError);

      await executeCapability(
        {} as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });
});
