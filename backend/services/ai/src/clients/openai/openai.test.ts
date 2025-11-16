import OpenAI from "openai";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskOutput } from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY, CAPABILITY_EXECUTION_ERROR_MESSAGE } from "@constants";
import { InternalError } from "@shared/errors";
import { Mocked } from "@shared/types";
import { withDurationAsync } from "@shared/utils/with-duration";
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

describe("executeParse", () => {
  let mockedOpenaiParse: Mocked<any>;
  let mockedWithDurationAsync: Mocked<typeof withDurationAsync>;

  const mockCapability = CAPABILITY.PARSE_TASK;
  const mockInput = "Submit Q2 report by next Friday";
  const mockPrompt: ResponseCreateParamsNonStreaming = {
    model: "gpt-4.1-mini",
    instructions: "Parse this task",
    input: mockInput,
    temperature: 0,
  };
  const mockUsage = {
    input_tokens: 150,
    output_tokens: 135,
  };
  const mockDurationMs = 250;
  const mockAiServiceRequestId = "ai-service-request-id";
  const mockOpenaiResponseId = "openai-response-id";

  beforeEach(async () => {
    const { openai } = await import("./openai");
    mockedOpenaiParse = vi.mocked(openai.responses.parse);
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "completed",
      output_parsed: mockParseTaskOutput,
      usage: mockUsage,
    } as any);

    mockedWithDurationAsync = vi.mocked(withDurationAsync);
    mockedWithDurationAsync.mockImplementation(async (fn) => {
      const result = await fn();

      return {
        result,
        durationMs: mockDurationMs,
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should execute parse successfully and return structured result", async () => {
    const result = await executeParse(
      mockCapability,
      mockInput,
      mockPrompt,
      mockAiServiceRequestId
    );

    expect(mockedWithDurationAsync).toHaveBeenCalledWith(expect.any(Function));
    expect(mockedOpenaiParse).toHaveBeenCalledWith(mockPrompt);
    expect(result).toEqual({
      openaiResponseId: mockOpenaiResponseId,
      output: mockParseTaskOutput,
      usage: {
        tokens: {
          input: mockUsage.input_tokens,
          output: mockUsage.output_tokens,
        },
      },
      durationMs: mockDurationMs,
    });
  });

  it("should throw error when OpenAI API error occurs", async () => {
    const mockOpenaiRequestId = "openai-request-id";
    const mockErrorMessage = "Incorrect API key provided";

    const apiError = new (OpenAI.APIError as any)(mockErrorMessage);
    apiError.requestID = mockOpenaiRequestId;
    apiError.error = { message: mockErrorMessage };
    apiError.status = 401;

    mockedOpenaiParse.mockRejectedValue(apiError);

    try {
      await executeParse(
        mockCapability,
        mockInput,
        mockPrompt,
        mockAiServiceRequestId
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).message).toBe(
        CAPABILITY_EXECUTION_ERROR_MESSAGE
      );
      expect((error as InternalError).context).toEqual({
        aiServiceRequestId: mockAiServiceRequestId,
        openaiRequestId: mockOpenaiRequestId,
      });
    }
  });

  it("should throw error when status is not completed", async () => {
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "in_progress",
      output_parsed: mockParseTaskOutput,
      usage: mockUsage,
    } as any);

    try {
      await executeParse(
        mockCapability,
        mockInput,
        mockPrompt,
        mockAiServiceRequestId
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).message).toBe(
        CAPABILITY_EXECUTION_ERROR_MESSAGE
      );
      expect((error as InternalError).context).toEqual({
        aiServiceRequestId: mockAiServiceRequestId,
        openaiResponseId: mockOpenaiResponseId,
      });
    }
  });

  it("should throw error when output_parsed is null", async () => {
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "completed",
      output_parsed: null,
      usage: mockUsage,
    } as any);

    try {
      await executeParse(
        mockCapability,
        mockInput,
        mockPrompt,
        mockAiServiceRequestId
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).message).toBe(
        CAPABILITY_EXECUTION_ERROR_MESSAGE
      );
      expect((error as InternalError).context).toEqual({
        aiServiceRequestId: mockAiServiceRequestId,
        openaiResponseId: mockOpenaiResponseId,
      });
    }
  });
});
