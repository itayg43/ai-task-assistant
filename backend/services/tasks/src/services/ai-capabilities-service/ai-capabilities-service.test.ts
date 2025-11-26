import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aiClient } from "@clients/ai";
import {
  DEFAULT_PARSE_TASK_CONFIG,
  PARSE_TASK_VAGUE_INPUT_ERROR,
} from "@constants";
import {
  mockAiCapabilityResponse,
  mockAiErrorData,
  mockAiErrorDataWithoutType,
  mockNaturalLanguage,
  mockRequestId,
} from "@mocks/tasks-mocks";
import { executeCapability } from "@services/ai-capabilities-service";
import { HttpError } from "@shared/clients/http";
import { DEFAULT_ERROR_MESSAGE } from "@shared/constants";
import { BadRequestError, InternalError } from "@shared/errors";
import { TExecuteCapabilityConfig } from "@types";

vi.mock("@clients/ai", () => ({
  aiClient: {
    post: vi.fn(),
  },
}));

describe("executeCapability", () => {
  let mockedAiClientPost: ReturnType<typeof vi.fn>;

  const createExecuteConfig = (
    naturalLanguage: string = "test"
  ): TExecuteCapabilityConfig<"parse-task"> => ({
    capability: "parse-task",
    pattern: "sync",
    params: {
      naturalLanguage,
      config: DEFAULT_PARSE_TASK_CONFIG,
    },
  });

  const createHttpError = (
    status: number,
    data?: Record<string, unknown>
  ): HttpError => {
    return new HttpError(undefined, undefined, undefined, undefined, {
      status,
      data,
    } as HttpError["response"]);
  };

  const createHttpErrorWithoutResponse = (message: string): HttpError => {
    return new HttpError(message);
  };

  beforeEach(() => {
    mockedAiClientPost = vi.mocked(aiClient.post);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully execute capability and return response", async () => {
    mockedAiClientPost.mockResolvedValue({
      data: mockAiCapabilityResponse,
    });

    const config = createExecuteConfig(mockNaturalLanguage);

    const result = await executeCapability(mockRequestId, config);

    expect(mockedAiClientPost).toHaveBeenCalledWith(
      "/capabilities/parse-task?pattern=sync",
      {
        naturalLanguage: mockNaturalLanguage,
        config: DEFAULT_PARSE_TASK_CONFIG,
      }
    );
    expect(result).toEqual(mockAiCapabilityResponse);
  });

  it("should handle HTTP 400 errors and throw BadRequestError", async () => {
    const mockHttpError = createHttpError(StatusCodes.BAD_REQUEST, {
      message: mockAiErrorDataWithoutType.message,
    });

    mockedAiClientPost.mockRejectedValue(mockHttpError);

    const config = createExecuteConfig();

    try {
      await executeCapability(mockRequestId, config);
      expect.fail("Should have thrown BadRequestError");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).message).toBe(
        mockAiErrorDataWithoutType.message
      );
    }
  });

  it(`should handle HTTP 400 errors with ${PARSE_TASK_VAGUE_INPUT_ERROR} type and include suggestions`, async () => {
    const mockHttpError = createHttpError(
      StatusCodes.BAD_REQUEST,
      mockAiErrorData
    );

    mockedAiClientPost.mockRejectedValue(mockHttpError);

    const config = createExecuteConfig();

    try {
      await executeCapability(mockRequestId, config);
      expect.fail("Should have thrown BadRequestError");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      const badRequestError = error as BadRequestError;
      expect(badRequestError.message).toBe(mockAiErrorData.message);
      expect(badRequestError.context?.suggestions).toEqual(
        (
          mockAiErrorData as {
            type: typeof PARSE_TASK_VAGUE_INPUT_ERROR;
            suggestions: string[];
          }
        ).suggestions
      );
    }
  });

  it("should handle HTTP 400 errors without message and throw InternalError", async () => {
    const mockHttpError = createHttpError(StatusCodes.BAD_REQUEST, {});

    mockedAiClientPost.mockRejectedValue(mockHttpError);

    const config = createExecuteConfig();

    try {
      await executeCapability(mockRequestId, config);
      expect.fail("Should have thrown InternalError");
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).message).toBe(DEFAULT_ERROR_MESSAGE);
    }
  });

  it("should handle HTTP errors (non-400) and throw InternalError", async () => {
    const mockHttpError = createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, {
      message: "Internal server error",
    });

    mockedAiClientPost.mockRejectedValue(mockHttpError);

    const config = createExecuteConfig();

    try {
      await executeCapability(mockRequestId, config);
      expect.fail("Should have thrown InternalError");
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).message).toBe(DEFAULT_ERROR_MESSAGE);
    }
  });

  it("should handle HTTP errors without response data and throw InternalError", async () => {
    const mockHttpError = createHttpErrorWithoutResponse("Network Error");

    mockedAiClientPost.mockRejectedValue(mockHttpError);

    const config = createExecuteConfig();

    try {
      await executeCapability(mockRequestId, config);
      expect.fail("Should have thrown InternalError");
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).message).toBe(DEFAULT_ERROR_MESSAGE);
    }
  });

  it("should propagate non-HTTP errors", async () => {
    const mockError = new Error("Network failure");
    mockedAiClientPost.mockRejectedValue(mockError);

    const config = createExecuteConfig();

    await expect(executeCapability(mockRequestId, config)).rejects.toThrow(
      "Network failure"
    );
  });
});
