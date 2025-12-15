import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskCapabilityResponse,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
import { mockOpenaiDurationMs } from "@mocks/openai-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { InternalError } from "@shared/errors";
import { Mocked } from "@shared/types";
import { withDurationAsync } from "@shared/utils/with-duration";
import { CapabilityConfig } from "@types";

vi.mock("@shared/utils/with-duration", () => ({
  withDurationAsync: vi.fn(),
}));

describe("executeSyncPattern", () => {
  let mockedWithDurationAsync: Mocked<typeof withDurationAsync>;

  let mockParse: ReturnType<typeof vi.fn>;
  let mockConfig: CapabilityConfig<any, any>;

  const mockInput = mockParseTaskValidatedInput;
  const mockResult = mockParseTaskCapabilityResponse;

  beforeEach(() => {
    mockParse = vi.fn();
    mockConfig = {
      ...mockParseTaskCapabilityConfig,
      outputSchema: {
        ...mockParseTaskCapabilityConfig.outputSchema,
        parse: mockParse,
      } as any,
    };

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

  it("should execute handler with duration tracking", async () => {
    mockParse.mockReturnValue(mockResult);

    const result = await executeSyncPattern(
      mockConfig,
      mockInput,
      mockAiServiceRequestId
    );

    expect(withDurationAsync).toHaveBeenCalled();
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

  it("should throw InternalError when output schema validation fails immediately", async () => {
    const mockZodErrorMessage = "invalid output";
    const mockZodError = new ZodError([
      {
        code: "custom",
        message: mockZodErrorMessage,
        path: [],
      },
    ]);

    mockParse.mockImplementation(() => {
      throw mockZodError;
    });

    await expect(
      executeSyncPattern(mockConfig, mockInput, mockAiServiceRequestId)
    ).rejects.toThrow(InternalError);
  });
});
