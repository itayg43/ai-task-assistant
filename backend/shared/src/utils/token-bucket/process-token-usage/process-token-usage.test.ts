import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MS_PER_SECOND } from "../../../constants";
import { createRedisClientMock } from "../../../mocks/redis-mock";
import { Mocked } from "../../../types";
import { getCurrentTime } from "../../date-time";
import {
  mockKey,
  mockTokenUsageConfig,
  mockUserId,
} from "../__tests__/token-usage-test-constants";
import { getTokenBucketKey } from "../key-utils";
import { processTokenUsage } from "../process-token-usage";
import {
  getTokenUsageState,
  incrementTokenUsage,
  resetTokenUsageWindow,
  ensureTokenUsageWindowTtl,
} from "../token-usage-state-utils";

vi.mock("../../date-time");
vi.mock("../key-utils");
vi.mock("../token-usage-state-utils", () => ({
  resetTokenUsageWindow: vi.fn(),
  getTokenUsageState: vi.fn(),
  incrementTokenUsage: vi.fn(),
  ensureTokenUsageWindowTtl: vi.fn(),
}));

describe("processTokenUsage", () => {
  let mockedGetCurrentTime: Mocked<typeof getCurrentTime>;
  let mockedGetTokenBucketKey: Mocked<typeof getTokenBucketKey>;
  let mockedGetTokenUsageState: Mocked<typeof getTokenUsageState>;
  let mockedResetTokenUsageWindow: Mocked<typeof resetTokenUsageWindow>;
  let mockedIncrementTokenUsage: Mocked<typeof incrementTokenUsage>;
  let mockedEnsureTokenUsageWindowTtl: Mocked<typeof ensureTokenUsageWindowTtl>;

  let mockRedisClient: Redis;

  beforeEach(() => {
    vi.useFakeTimers();

    mockedGetCurrentTime = vi.mocked(getCurrentTime);

    mockedGetTokenBucketKey = vi.mocked(getTokenBucketKey);
    mockedGetTokenBucketKey.mockReturnValue(mockKey);

    mockedGetTokenUsageState = vi.mocked(getTokenUsageState);
    mockedResetTokenUsageWindow = vi.mocked(resetTokenUsageWindow);
    mockedIncrementTokenUsage = vi.mocked(incrementTokenUsage);
    mockedEnsureTokenUsageWindowTtl = vi.mocked(ensureTokenUsageWindowTtl);

    mockRedisClient = createRedisClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should handle multiple sequential requests in same window", async () => {
    const mockNow = 1000000;
    const windowSizeSecondsMs =
      mockTokenUsageConfig.windowSizeSeconds * MS_PER_SECOND;
    const calculatedWindowStart =
      Math.floor(mockNow / windowSizeSecondsMs) * windowSizeSecondsMs;

    vi.setSystemTime(mockNow);
    mockedGetCurrentTime.mockReturnValue(mockNow);

    // First request: allowed, tokensUsed = 100
    mockedGetTokenUsageState.mockResolvedValue({
      tokensUsed: 0,
      windowStartTimestamp: calculatedWindowStart,
    });
    mockedIncrementTokenUsage.mockResolvedValue(100);

    let result = await processTokenUsage(
      mockRedisClient,
      mockTokenUsageConfig,
      mockUserId
    );
    expect(result.allowed).toBe(true);
    expect(result.tokensUsed).toBe(100);
    expect(result.tokensReserved).toBe(100);
    expect(result.tokensRemaining).toBe(900);

    // Verify ensureTokenUsageWindowTtl was called with correct parameters
    expect(mockedEnsureTokenUsageWindowTtl).toHaveBeenCalledWith(
      mockRedisClient,
      mockKey,
      calculatedWindowStart,
      mockTokenUsageConfig.windowSizeSeconds,
      mockNow
    );

    // Second request: allowed, tokensUsed = 200
    mockedGetTokenUsageState.mockResolvedValue({
      tokensUsed: 100,
      windowStartTimestamp: calculatedWindowStart,
    });
    mockedIncrementTokenUsage.mockResolvedValue(200);

    result = await processTokenUsage(
      mockRedisClient,
      mockTokenUsageConfig,
      mockUserId
    );
    expect(result.allowed).toBe(true);
    expect(result.tokensUsed).toBe(200);
    expect(result.tokensReserved).toBe(100);
    expect(result.tokensRemaining).toBe(800);

    // Third request: denied, exceeds limit
    mockedGetTokenUsageState.mockResolvedValue({
      tokensUsed: 950,
      windowStartTimestamp: calculatedWindowStart,
    });

    result = await processTokenUsage(
      mockRedisClient,
      mockTokenUsageConfig,
      mockUserId
    );
    expect(result.allowed).toBe(false);
    expect(result.tokensUsed).toBe(950);
    expect(result.tokensReserved).toBe(0);
    expect(result.tokensRemaining).toBe(50);
    expect(mockedIncrementTokenUsage).not.toHaveBeenCalledTimes(3);
  });

  it("should reset window when window boundary is crossed", async () => {
    const oldWindowStart = 0;
    const mockNow = 86400000; // Start of second window (24 hours later)
    const windowSizeSecondsMs =
      mockTokenUsageConfig.windowSizeSeconds * MS_PER_SECOND;
    const newWindowStart =
      Math.floor(mockNow / windowSizeSecondsMs) * windowSizeSecondsMs;

    vi.setSystemTime(mockNow);
    mockedGetCurrentTime.mockReturnValue(mockNow);

    mockedGetTokenUsageState.mockResolvedValue({
      tokensUsed: 999,
      windowStartTimestamp: oldWindowStart, // Old window
    });
    mockedIncrementTokenUsage.mockResolvedValue(100);

    const result = await processTokenUsage(
      mockRedisClient,
      mockTokenUsageConfig,
      mockUserId
    );

    expect(mockedResetTokenUsageWindow).toHaveBeenCalledWith(
      mockRedisClient,
      mockKey,
      newWindowStart,
      mockTokenUsageConfig.windowSizeSeconds
    );
    expect(result.allowed).toBe(true);
    expect(result.tokensUsed).toBe(100); // After reset and increment
    expect(result.windowStartTimestamp).toBe(newWindowStart);

    // Verify ensureTokenUsageWindowTtl was called with the new window
    expect(mockedEnsureTokenUsageWindowTtl).toHaveBeenCalledWith(
      mockRedisClient,
      mockKey,
      newWindowStart,
      mockTokenUsageConfig.windowSizeSeconds,
      mockNow
    );
  });

  it("should reset window but deny if still exceeds limit after reset", async () => {
    const oldWindowStart = 0;
    const mockNow = 86400000; // Start of second window
    const windowSizeSecondsMs =
      mockTokenUsageConfig.windowSizeSeconds * MS_PER_SECOND;
    const newWindowStart =
      Math.floor(mockNow / windowSizeSecondsMs) * windowSizeSecondsMs;

    // Use a config with very high estimatedTokens that exceeds limit even after reset
    const highEstimatedConfig = {
      ...mockTokenUsageConfig,
      estimatedTokens: 1500, // Exceeds windowTokensLimit of 1000
    };

    vi.setSystemTime(mockNow);
    mockedGetCurrentTime.mockReturnValue(mockNow);

    mockedGetTokenUsageState.mockResolvedValue({
      tokensUsed: 999,
      windowStartTimestamp: oldWindowStart,
    });

    const result = await processTokenUsage(
      mockRedisClient,
      highEstimatedConfig,
      mockUserId
    );

    expect(mockedResetTokenUsageWindow).toHaveBeenCalledWith(
      mockRedisClient,
      mockKey,
      newWindowStart,
      highEstimatedConfig.windowSizeSeconds
    );
    expect(result.allowed).toBe(false);
    expect(result.tokensUsed).toBe(0); // After reset
    expect(result.tokensReserved).toBe(0);
    expect(result.tokensRemaining).toBe(highEstimatedConfig.windowTokensLimit);
    expect(mockedIncrementTokenUsage).not.toHaveBeenCalled();
  });
});
