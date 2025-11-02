import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CAPABILITY } from "@constants";
import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
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

  let mockSafeParse: ReturnType<typeof vi.fn>;

  const mockConfig: CapabilityConfig<any, any> = {
    name: CAPABILITY.PARSE_TASK,
    handler: vi.fn(),
    inputSchema: {} as any,
    outputSchema: {} as any,
  };
  const mockInput = {
    test: "input",
  };
  const mockResult = {
    success: true,
  };
  const mockDuration = 100;
  const mockRequestId = "test-request-id";

  beforeEach(() => {
    mockSafeParse = vi.fn();
    mockConfig.outputSchema = {
      safeParse: mockSafeParse,
    } as any;

    mockedWithRetry = vi.mocked(withRetry);
    mockedWithRetry.mockImplementation(async (_retryConfig, fn) => {
      return await fn();
    });

    mockedWithDurationAsync = vi.mocked(withDurationAsync);
    mockedWithDurationAsync.mockImplementation(async (callback) => {
      const result = await callback();

      return {
        result,
        durationMs: mockDuration,
      };
    });

    mockConfig.handler = vi.fn().mockResolvedValue(mockResult);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should execute handler with retry and duration tracking", async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: mockResult,
    });

    const result = await executeSyncPattern(
      mockConfig,
      mockInput,
      mockRequestId
    );

    expect(withDurationAsync).toHaveBeenCalled();
    expect(withRetry).toHaveBeenCalledWith(
      DEFAULT_RETRY_CONFIG,
      expect.any(Function)
    );
    expect(mockConfig.handler).toHaveBeenCalledWith(mockInput, mockRequestId);
    expect(mockSafeParse).toHaveBeenCalledWith(mockResult);
    expect(result).toEqual({
      result: mockResult,
      durationMs: mockDuration,
    });
  });

  it("should throw when output schema validation fails", async () => {
    const mockErrorMessage = "invalid output";

    mockSafeParse.mockReturnValue({
      success: false,
      error: {
        message: mockErrorMessage,
      },
    });

    await expect(
      executeSyncPattern(mockConfig, mockInput, mockRequestId)
    ).rejects.toThrow(expect.any(Error));
  });
});
