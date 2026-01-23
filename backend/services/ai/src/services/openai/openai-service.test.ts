import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PARSE_TASK_CAPABILITY,
  PARSE_TASK_CORE_OPERATION,
} from "@capabilities/parse-task/parse-task-constants";
import {
  mockNaturalLanguage,
  mockParseTaskOutput,
} from "@capabilities/parse-task/parse-task-mocks";
import { parseWithValidation } from "@clients/openai";
import { CAPABILITY_EXECUTION_ERROR_MESSAGE } from "@constants";
import {
  recordOpenAiApiFailureMetrics,
  recordOpenAiApiSuccessMetrics,
} from "@metrics/openai-metrics";
import {
  MockAPIError,
  mockOpenaiDurationMs,
  mockOpenaiRequestId,
  mockOpenaiResponseId,
  mockOpenaiTokenUsage,
  mockPrompt,
  mockPromptVersion,
} from "@mocks/openai-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { executeParse } from "@services/openai";
import { InternalError } from "@shared/errors";
import { Mocked } from "@shared/types";
import { withDurationAsync } from "@shared/utils/with-duration";
import { withRetry } from "@shared/utils/with-retry";

vi.mock("@config/env", () => ({
  env: {
    OPENAI_API_KEY: "test-key",
  },
}));

vi.mock("openai", () => ({
  default: class {
    static APIError = MockAPIError;
  },
}));

vi.mock("@clients/openai", () => ({
  parseWithValidation: vi.fn(),
}));

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
  let mockedParseWithValidation: Mocked<typeof parseWithValidation>;
  let mockedWithDurationAsync: Mocked<typeof withDurationAsync>;
  let mockedWithRetry: Mocked<typeof withRetry>;
  let mockedRecordSuccessMetrics: Mocked<typeof recordOpenAiApiSuccessMetrics>;
  let mockedRecordFailureMetrics: Mocked<typeof recordOpenAiApiFailureMetrics>;

  beforeEach(async () => {
    mockedParseWithValidation = vi.mocked(parseWithValidation);
    mockedParseWithValidation.mockResolvedValue({
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
      mockAiServiceRequestId,
    );

    expect(mockedWithDurationAsync).toHaveBeenCalled();
    expect(mockedWithRetry).toHaveBeenCalled();
    expect(mockedParseWithValidation).toHaveBeenCalledWith(
      mockPrompt,
      expect.any(Function),
    );

    expect(result).toEqual({
      openaiResponseId: mockOpenaiResponseId,
      output: mockParseTaskOutput,
      usage: {
        tokens: mockOpenaiTokenUsage,
      },
      durationMs: mockOpenaiDurationMs,
    });

    expect(mockedRecordSuccessMetrics).toHaveBeenCalledWith(
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_CORE_OPERATION,
      mockPrompt.model,
      mockOpenaiDurationMs,
      mockOpenaiTokenUsage.input,
      mockOpenaiTokenUsage.output,
      mockAiServiceRequestId,
    );
  });

  it("should handle OpenAI API errors by wrapping them and recording failure", async () => {
    const apiError = new MockAPIError(
      "Rate limit reached",
      429,
      mockOpenaiRequestId,
    );
    mockedParseWithValidation.mockRejectedValue(apiError);

    await expect(
      executeParse(
        PARSE_TASK_CAPABILITY,
        PARSE_TASK_CORE_OPERATION,
        mockNaturalLanguage,
        mockPrompt,
        mockPromptVersion,
        mockAiServiceRequestId,
      ),
    ).rejects.toThrow(InternalError);

    expect(mockedRecordFailureMetrics).toHaveBeenCalledWith(
      PARSE_TASK_CAPABILITY,
      PARSE_TASK_CORE_OPERATION,
      mockAiServiceRequestId,
    );
  });

  it("should handle generic errors safely", async () => {
    mockedParseWithValidation.mockRejectedValue(
      new Error("Unexpected failure"),
    );

    try {
      await executeParse(
        PARSE_TASK_CAPABILITY,
        PARSE_TASK_CORE_OPERATION,
        mockNaturalLanguage,
        mockPrompt,
        mockPromptVersion,
        mockAiServiceRequestId,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).message).toBe(
        CAPABILITY_EXECUTION_ERROR_MESSAGE,
      );
    }

    expect(mockedRecordFailureMetrics).toHaveBeenCalled();
  });
});
