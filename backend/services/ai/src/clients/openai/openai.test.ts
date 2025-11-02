import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskOutput } from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY } from "@constants";
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

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: {
      parse: vi.fn(),
    },
  })),
}));

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
  const mockRequestId = "test-request-id";

  beforeEach(async () => {
    const { openai } = await import("./openai");
    mockedOpenaiParse = vi.mocked(openai.responses.parse);
    mockedOpenaiParse.mockResolvedValue({
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
      mockRequestId
    );

    expect(mockedWithDurationAsync).toHaveBeenCalledWith(expect.any(Function));
    expect(mockedOpenaiParse).toHaveBeenCalledWith(mockPrompt);
    expect(result).toEqual({
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

  it("should handle missing usage tokens gracefully", async () => {
    mockedOpenaiParse.mockResolvedValue({
      output_parsed: mockParseTaskOutput,
      usage: undefined,
    });

    const result = await executeParse(
      mockCapability,
      mockInput,
      mockPrompt,
      mockRequestId
    );

    expect(result.usage.tokens.input).toBe(0);
    expect(result.usage.tokens.output).toBe(0);
  });

  it("should throw error when output_parsed is missing", async () => {
    mockedOpenaiParse.mockResolvedValue({
      output_parsed: null,
      usage: mockUsage,
    });

    await expect(
      executeParse(mockCapability, mockInput, mockPrompt, mockRequestId)
    ).rejects.toThrow(expect.any(Error));
  });

  it("should propagate OpenAI API errors", async () => {
    const apiError = new Error("OpenAI API Error");
    mockedOpenaiParse.mockRejectedValue(apiError);

    await expect(
      executeParse(mockCapability, mockInput, mockPrompt, mockRequestId)
    ).rejects.toThrow(apiError);
  });
});
