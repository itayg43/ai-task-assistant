import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskOutput } from "@capabilities/parse-task/parse-task-mocks";
import {
  MockAPIError,
  mockOpenaiResponseId,
  mockOpenaiTokenUsage,
  mockPrompt,
} from "@mocks/openai-mocks";
import { InternalError } from "@shared/errors";
import { Mocked } from "@shared/types";
import { openai, parseWithValidation } from "./openai";

vi.mock("@config/env", () => ({
  env: {
    OPENAI_API_KEY: "test-key",
  },
}));

vi.mock("openai", () => {
  return {
    default: class {
      responses = {
        parse: vi.fn(),
      };
      static APIError = MockAPIError;
    },
  };
});

describe("parseWithValidation", () => {
  let mockedOpenaiParse: Mocked<any>;

  beforeEach(() => {
    mockedOpenaiParse = vi.mocked(openai.responses.parse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return parsed output when response is completed and has output", async () => {
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "completed",
      output_parsed: mockParseTaskOutput,
      usage: {
        input_tokens: mockOpenaiTokenUsage.input,
        output_tokens: mockOpenaiTokenUsage.output,
      },
    } as any);

    const result = await parseWithValidation(mockPrompt);

    expect(result.id).toBe(mockOpenaiResponseId);
    expect(result.output_parsed).toEqual(mockParseTaskOutput);
    expect(mockedOpenaiParse).toHaveBeenCalledWith(mockPrompt);
  });

  it("should call onResponseReceived with the ID if provided", async () => {
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "completed",
      output_parsed: mockParseTaskOutput,
    } as any);

    const onResponseReceived = vi.fn();
    await parseWithValidation(mockPrompt, onResponseReceived);

    expect(onResponseReceived).toHaveBeenCalledWith(mockOpenaiResponseId);
  });

  it("should throw InternalError if status is not completed", async () => {
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "in_progress",
      output_parsed: mockParseTaskOutput,
    } as any);

    await expect(parseWithValidation(mockPrompt)).rejects.toThrow(
      new InternalError("OpenAI returned an uncompleted response."),
    );
  });

  it("should throw InternalError if output_parsed is missing", async () => {
    mockedOpenaiParse.mockResolvedValue({
      id: mockOpenaiResponseId,
      status: "completed",
      output_parsed: null,
    } as any);

    await expect(parseWithValidation(mockPrompt)).rejects.toThrow(
      new InternalError("OpenAI failed to parse the output correctly."),
    );
  });
});
