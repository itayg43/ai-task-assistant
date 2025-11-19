import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskCapabilityResponse,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY_EXECUTION_ERROR_MESSAGE } from "@constants";
import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
import { mockOpenaiDurationMs } from "@mocks/openai-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { InternalError } from "@shared/errors";
import { Mocked } from "@shared/types";
import { withDurationAsync } from "@shared/utils/with-duration";
import { withRetry } from "@shared/utils/with-retry";
import { CapabilityConfig } from "@types";

vi.mock("@shared/utils/with-duration", () => ({
  withDurationAsync: vi.fn(),
}));

vi.mock("@shared/utils/with-retry", () => ({
  withRetry: vi.fn(),
}));

describe("executeSyncPattern", () => {
  let mockedWithRetry: Mocked<typeof withRetry>;
  let mockedWithDurationAsync: Mocked<typeof withDurationAsync>;

  let mockParse: ReturnType<typeof vi.fn>;
  let mockConfig: CapabilityConfig<any, any>;

  const mockInput = mockParseTaskValidatedInput;
  const mockResult = mockParseTaskCapabilityResponse;
  const mockZodErrorMessage = "invalid output";
  const mockZodError = new ZodError([
    {
      code: "custom",
      message: mockZodErrorMessage,
      path: [],
    },
  ]);

  beforeEach(() => {
    mockParse = vi.fn();
    mockConfig = {
      ...mockParseTaskCapabilityConfig,
      outputSchema: {
        ...mockParseTaskCapabilityConfig.outputSchema,
        parse: mockParse,
      } as any,
    };

    mockedWithRetry = vi.mocked(withRetry);
    mockedWithRetry.mockImplementation(async (retryConfig, fn, _context) => {
      let attempt = 1;
      let lastError: unknown;

      while (attempt <= retryConfig.maxAttempts) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          if (attempt === retryConfig.maxAttempts) {
            break;
          }
          attempt++;
        }
      }

      throw lastError;
    });

    mockedWithDurationAsync = vi.mocked(withDurationAsync);
    mockedWithDurationAsync.mockImplementation(async (callback) => {
      const result = await callback();

      return {
        result,
        durationMs: mockOpenaiDurationMs,
      };
    });

    vi.spyOn(mockConfig, "handler");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should execute handler with retry and duration tracking", async () => {
    mockParse.mockReturnValue(mockResult);

    const result = await executeSyncPattern(
      mockConfig,
      mockInput,
      mockAiServiceRequestId
    );

    expect(withDurationAsync).toHaveBeenCalled();
    expect(withRetry).toHaveBeenCalledWith(
      DEFAULT_RETRY_CONFIG,
      expect.any(Function),
      {
        requestId: mockAiServiceRequestId,
      }
    );
    expect(mockConfig.handler).toHaveBeenCalledWith(
      mockInput,
      mockAiServiceRequestId
    );
    expect(mockParse).toHaveBeenCalledWith(mockResult);
    expect(result).toEqual({
      result: mockResult,
      durationMs: mockOpenaiDurationMs,
    });
  });

  it("should throw when output schema validation fails after all retries", async () => {
    mockParse.mockImplementation(() => {
      throw mockZodError;
    });

    // Verify the error is an InternalError with correct message and context
    try {
      await executeSyncPattern(mockConfig, mockInput, mockAiServiceRequestId);
    } catch (error) {
      const internalError = error as InternalError;

      expect(internalError).toBeInstanceOf(InternalError);
      expect(internalError.message).toBe(CAPABILITY_EXECUTION_ERROR_MESSAGE);
      expect(internalError.context).toEqual({
        aiServiceRequestId: mockAiServiceRequestId,
      });
    }

    // Verify that validation was called inside retry (should be called maxAttempts times)
    expect(mockParse).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxAttempts);
    expect(mockConfig.handler).toHaveBeenCalledTimes(
      DEFAULT_RETRY_CONFIG.maxAttempts
    );
  });

  it("should retry when validation fails then succeed", async () => {
    // First attempt fails validation, second succeeds
    mockParse
      .mockImplementationOnce(() => {
        throw mockZodError;
      })
      .mockReturnValueOnce(mockResult);

    const result = await executeSyncPattern(
      mockConfig,
      mockInput,
      mockAiServiceRequestId
    );

    // Should have retried once (2 total attempts)
    expect(mockConfig.handler).toHaveBeenCalledTimes(2);
    expect(mockParse).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      result: mockResult,
      durationMs: mockOpenaiDurationMs,
    });
  });
});
