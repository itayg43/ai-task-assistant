import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PARSE_TASK_CAPABILITY,
  PARSE_TASK_CORE_OPERATION,
} from "@capabilities/parse-task/parse-task-constants";
import {
  mockNaturalLanguage,
  mockParseTaskOutput,
} from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY_EXECUTION_ERROR_MESSAGE } from "@constants";
import {
  recordOpenAiApiFailureMetrics,
  recordOpenAiApiSuccessMetrics,
} from "@metrics/openai-metrics";
import {
  mockOpenaiDurationMs,
  mockOpenaiRequestId,
  mockOpenaiResponseId,
  mockOpenaiTokenUsage,
  mockPrompt,
  mockPromptVersion,
} from "@mocks/openai-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { InternalError } from "@shared/errors";
import { Mocked } from "@shared/types";
import { withDurationAsync } from "@shared/utils/with-duration";
import { withRetry } from "@shared/utils/with-retry";
import { executeParse } from "./openai";

vi.mock("@config/env", () => ({
  env: {
    OPENAI_API_KEY: "test-key",
    SERVICE_NAME: "test-service",
    SERVICE_PORT: 3000,
  },
}));

vi.mock("openai", () => {
  class MockAPIError extends Error {
    requestID?: string;
    error?: { message?: string };
    status?: number;
  }

  class MockOpenAI {
    responses = {
      parse: vi.fn(),
    };

    static APIError = MockAPIError;
  }

  return {
    default: MockOpenAI,
  };
});

vi.mock("@shared/utils/with-duration", () => ({
  withDurationAsync: vi.fn(),
}));

vi.mock("@shared/utils/with-retry", () => ({
  withRetry: vi.fn(),
}));

vi.mock("@metrics/openai-metrics", () => ({
  recordOpenAiApiSuccessMetrics: vi.fn(),
  recordOpenAiApiFailureMetrics: vi.fn(),
}));

describe("executeParse", () => {
  let mockedOpenaiParse: Mocked<any>;
  let mockedWithDurationAsync: Mocked<typeof withDurationAsync>;
  let mockedWithRetry: Mocked<typeof withRetry>;
  let mockedRecordSuccessMetrics: Mocked<typeof recordOpenAiApiSuccessMetrics>;
  let mockedRecordFailureMetrics: Mocked<typeof recordOpenAiApiFailureMetrics>;

  beforeEach(async () => {
    const { openai } = await import("./openai");
    mockedOpenaiParse = vi.mocked(openai.responses.parse);
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "completed",
      output_parsed: mockParseTaskOutput,
      usage: {
        input_tokens: mockOpenaiTokenUsage.input,
        output_tokens: mockOpenaiTokenUsage.output,
      },
    } as any);

    mockedWithDurationAsync = vi.mocked(withDurationAsync);
    mockedWithDurationAsync.mockImplementation(async (fn) => {
      const result = await fn();

      return {
        result,
        durationMs: mockOpenaiDurationMs,
      };
    });

    mockedWithRetry = vi.mocked(withRetry);
    // Default: pass through the function call (simulates successful first attempt)
    mockedWithRetry.mockImplementation(async (_config, fn) => {
      return await fn();
    });

    mockedRecordSuccessMetrics = vi.mocked(recordOpenAiApiSuccessMetrics);
    mockedRecordFailureMetrics = vi.mocked(recordOpenAiApiFailureMetrics);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should execute parse successfully and return structured result", async () => {
    const result = await executeParse(
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_CORE_OPERATION,
      mockNaturalLanguage,
      mockPrompt,
      mockPromptVersion,
      mockAiServiceRequestId
    );

    expect(mockedWithDurationAsync).toHaveBeenCalledWith(expect.any(Function));
    expect(mockedWithRetry).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Function),
      expect.objectContaining({
        requestId: mockAiServiceRequestId,
        capability: PARSE_TASK_CAPABILITY,
        operation: PARSE_TASK_CORE_OPERATION,
      })
    );
    expect(mockedOpenaiParse).toHaveBeenCalledWith(mockPrompt);
    expect(result).toEqual({
      openaiResponseId: mockOpenaiResponseId,
      output: mockParseTaskOutput,
      usage: {
        tokens: mockOpenaiTokenUsage,
      },
      durationMs: mockOpenaiDurationMs,
    });

    expect(mockedRecordSuccessMetrics).toHaveBeenCalledTimes(1);
    expect(mockedRecordSuccessMetrics).toHaveBeenCalledWith(
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_CORE_OPERATION,
      mockPrompt.model,
      mockOpenaiDurationMs,
      mockOpenaiTokenUsage.input,
      mockOpenaiTokenUsage.output
    );
    expect(mockedRecordFailureMetrics).not.toHaveBeenCalled();
  });

  it("should throw error when status is not completed", async () => {
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "in_progress",
      output_parsed: mockParseTaskOutput,
      usage: {
        input_tokens: mockOpenaiTokenUsage.input,
        output_tokens: mockOpenaiTokenUsage.output,
      },
    } as any);

    try {
      await executeParse(
        PARSE_TASK_CAPABILITY,
        PARSE_TASK_CORE_OPERATION,
        mockNaturalLanguage,
        mockPrompt,
        mockPromptVersion,
        mockAiServiceRequestId
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).message).toBe(
        CAPABILITY_EXECUTION_ERROR_MESSAGE
      );
      expect((error as InternalError).context).toEqual({
        openaiResponseId: mockOpenaiResponseId,
      });
    }

    expect(mockedRecordFailureMetrics).toHaveBeenCalledTimes(1);
    expect(mockedRecordFailureMetrics).toHaveBeenCalledWith(
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_CORE_OPERATION
    );
    expect(mockedRecordSuccessMetrics).not.toHaveBeenCalled();
  });

  it("should throw error when output_parsed is null", async () => {
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "completed",
      output_parsed: null,
      usage: {
        input_tokens: mockOpenaiTokenUsage.input,
        output_tokens: mockOpenaiTokenUsage.output,
      },
    } as any);

    try {
      await executeParse(
        PARSE_TASK_CAPABILITY,
        PARSE_TASK_CORE_OPERATION,
        mockNaturalLanguage,
        mockPrompt,
        mockPromptVersion,
        mockAiServiceRequestId
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).message).toBe(
        CAPABILITY_EXECUTION_ERROR_MESSAGE
      );
      expect((error as InternalError).context).toEqual({
        openaiResponseId: mockOpenaiResponseId,
      });
    }

    expect(mockedRecordFailureMetrics).toHaveBeenCalledTimes(1);
    expect(mockedRecordFailureMetrics).toHaveBeenCalledWith(
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_CORE_OPERATION
    );
    expect(mockedRecordSuccessMetrics).not.toHaveBeenCalled();
  });

  it("should succeed after retry and record metrics once", async () => {
    // First attempt fails, second succeeds
    mockedOpenaiParse
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        id: mockOpenaiResponseId,
        status: "completed",
        output_parsed: mockParseTaskOutput,
        usage: {
          input_tokens: mockOpenaiTokenUsage.input,
          output_tokens: mockOpenaiTokenUsage.output,
        },
      } as any);

    // Mock withRetry to simulate retry: first call fails, second succeeds
    let attemptCount = 0;
    mockedWithRetry.mockImplementation(async (_config, fn) => {
      attemptCount++;
      if (attemptCount === 1) {
        try {
          return await fn();
        } catch {
          // Simulate retry delay, then retry
          await new Promise((resolve) => setTimeout(resolve, 10));
          return await fn();
        }
      }
      return await fn();
    });

    const result = await executeParse(
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_CORE_OPERATION,
      mockNaturalLanguage,
      mockPrompt,
      mockPromptVersion,
      mockAiServiceRequestId
    );

    expect(result).toEqual({
      openaiResponseId: mockOpenaiResponseId,
      output: mockParseTaskOutput,
      usage: {
        tokens: mockOpenaiTokenUsage,
      },
      durationMs: mockOpenaiDurationMs,
    });

    expect(mockedRecordSuccessMetrics).toHaveBeenCalledTimes(1);
    expect(mockedRecordFailureMetrics).not.toHaveBeenCalled();
  });

  it("should fail after all retries exhausted and record metrics once", async () => {
    const apiError = new (OpenAI.APIError as any)("API error");
    apiError.requestID = mockOpenaiRequestId;
    apiError.error = { message: "API error" };
    apiError.status = 500;

    mockedOpenaiParse.mockRejectedValue(apiError);

    // Mock withRetry to simulate all retries failing
    let attemptCount = 0;
    mockedWithRetry.mockImplementation(async (_config, fn) => {
      attemptCount++;
      try {
        return await fn();
      } catch (error) {
        if (attemptCount < 3) {
          // Simulate retry delay
          await new Promise((resolve) => setTimeout(resolve, 10));
          return await fn();
        }
        throw error;
      }
    });

    try {
      await executeParse(
        PARSE_TASK_CAPABILITY,
        PARSE_TASK_CORE_OPERATION,
        mockNaturalLanguage,
        mockPrompt,
        mockPromptVersion,
        mockAiServiceRequestId
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
    }

    expect(mockedRecordFailureMetrics).toHaveBeenCalledTimes(1);
    expect(mockedRecordSuccessMetrics).not.toHaveBeenCalled();
  });
});
