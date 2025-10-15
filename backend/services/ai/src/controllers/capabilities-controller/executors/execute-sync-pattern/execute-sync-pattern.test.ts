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

  beforeEach(() => {
    mockedWithRetry = vi.mocked(withRetry);
    mockedWithRetry.mockResolvedValue(mockResult);

    mockedWithDurationAsync = vi.mocked(withDurationAsync);
    mockedWithDurationAsync.mockImplementation(async (callback) => {
      const result = await callback();

      return {
        result,
        durationMs: mockDuration,
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should execute handler with retry and duration tracking", async () => {
    const result = await executeSyncPattern(mockConfig, mockInput);

    expect(withDurationAsync).toHaveBeenCalled();
    expect(withRetry).toHaveBeenCalledWith(
      DEFAULT_RETRY_CONFIG,
      expect.any(Function)
    );
    expect(result).toEqual({
      result: mockResult,
      durationMs: mockDuration,
    });
  });
});
