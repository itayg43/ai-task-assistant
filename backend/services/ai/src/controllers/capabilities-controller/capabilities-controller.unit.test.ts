import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { executeCapability } from "@controllers/capabilities-controller/capabilities-controller";
import { executeAsyncPattern } from "@controllers/capabilities-controller/executors/execute-async-pattern";
import { mockCallbackUrl } from "@mocks/callbackUrl-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { Mocked } from "@shared/types";
import { getCapabilityConfig } from "@utils/get-capability-config";
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";
import { getCapabilityValidatedQuery } from "@utils/get-capability-validated-query";

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

vi.mock(
  "@controllers/capabilities-controller/executors/execute-async-pattern",
  () => ({
    executeAsyncPattern: vi.fn(),
  })
);

describe("capabilitiesController (unit)", () => {
  let mockedGetCapabilityConfig: Mocked<typeof getCapabilityConfig>;
  let mockedGetCapabilityValidatedInput: Mocked<
    typeof getCapabilityValidatedInput
  >;
  let mockedGetCapabilityValidatedQuery: Mocked<
    typeof getCapabilityValidatedQuery
  >;
  let mockedExecuteAsyncPattern: Mocked<typeof executeAsyncPattern>;

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
      callbackUrl: mockCallbackUrl,
    });

    mockedExecuteAsyncPattern = vi.mocked(executeAsyncPattern);
    mockedExecuteAsyncPattern.mockResolvedValue("");

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
    expect(mockedExecuteAsyncPattern).toHaveBeenCalledWith(
      mockAiServiceRequestId,
      mockParseTaskCapabilityConfig,
      mockParseTaskValidatedInput,
      mockCallbackUrl
    );
    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.ACCEPTED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: expect.any(String),
      aiServiceRequestId: mockAiServiceRequestId,
    });
    expect(mockNextFunction).not.toHaveBeenCalled();
  });

  it("should pass executor errors to next", async () => {
    const mockError = new Error("failure");
    mockedExecuteAsyncPattern.mockRejectedValue(mockError);

    await executeCapability(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );

    expect(mockNextFunction).toHaveBeenCalledWith(mockError);
  });
});
