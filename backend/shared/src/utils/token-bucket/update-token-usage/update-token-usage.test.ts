import Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRedisClientMock } from "../../../mocks/redis-mock";
import { Mocked } from "../../../types";
import {
  mockKey,
  mockTokenUsageConfig,
  mockTokensUsed,
  mockUserId,
  mockWindowStartTimestamp,
} from "../__tests__/token-usage-test-constants";
import { getTokenBucketKey } from "../key-utils";
import {
  decrementTokenUsage,
  getTokenUsageState,
  incrementTokenUsage,
} from "../token-usage-state-utils";
import { updateTokenUsage } from "../update-token-usage";

vi.mock("../key-utils");
vi.mock("../token-usage-state-utils", () => ({
  decrementTokenUsage: vi.fn(),
  getTokenUsageState: vi.fn(),
  incrementTokenUsage: vi.fn(),
}));

describe("updateTokenUsage", () => {
  let mockedGetTokenBucketKey: Mocked<typeof getTokenBucketKey>;
  let mockedGetTokenUsageState: Mocked<typeof getTokenUsageState>;
  let mockedIncrementTokenUsage: Mocked<typeof incrementTokenUsage>;
  let mockedDecrementTokenUsage: Mocked<typeof decrementTokenUsage>;

  let mockRedisClient: Redis;

  beforeEach(() => {
    mockedGetTokenBucketKey = vi.mocked(getTokenBucketKey);
    mockedGetTokenBucketKey.mockReturnValue(mockKey);

    mockedGetTokenUsageState = vi.mocked(getTokenUsageState);
    mockedGetTokenUsageState.mockResolvedValue({
      tokensUsed: mockTokensUsed,
      windowStartTimestamp: mockWindowStartTimestamp,
    });

    mockedIncrementTokenUsage = vi.mocked(incrementTokenUsage);
    mockedDecrementTokenUsage = vi.mocked(decrementTokenUsage);

    mockRedisClient = createRedisClientMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not adjust when actual tokens equals reserved tokens", async () => {
    const actualTokens = 100;
    const reservedTokens = 100;

    await updateTokenUsage(
      mockRedisClient,
      mockTokenUsageConfig.serviceName,
      mockTokenUsageConfig.rateLimiterName,
      mockUserId,
      actualTokens,
      reservedTokens,
      mockWindowStartTimestamp
    );

    expect(mockedGetTokenUsageState).toHaveBeenCalledWith(
      mockRedisClient,
      mockKey,
      mockWindowStartTimestamp
    );
    expect(mockedIncrementTokenUsage).not.toHaveBeenCalled();
    expect(mockedDecrementTokenUsage).not.toHaveBeenCalled();
  });

  it("should release excess tokens when actual < reserved", async () => {
    const actualTokens = 80;
    const reservedTokens = 100;
    const diff = reservedTokens - actualTokens; // 20
    const expectedNewTokensUsed = mockTokensUsed - diff; // 480

    mockedDecrementTokenUsage.mockResolvedValue(expectedNewTokensUsed);

    await updateTokenUsage(
      mockRedisClient,
      mockTokenUsageConfig.serviceName,
      mockTokenUsageConfig.rateLimiterName,
      mockUserId,
      actualTokens,
      reservedTokens,
      mockWindowStartTimestamp
    );

    expect(mockedDecrementTokenUsage).toHaveBeenCalledWith(
      mockRedisClient,
      mockKey,
      diff
    );
    expect(mockedIncrementTokenUsage).not.toHaveBeenCalled();
  });

  it("should add difference when actual > reserved", async () => {
    const actualTokens = 120;
    const reservedTokens = 100;
    const diff = reservedTokens - actualTokens; // -20
    const absDiff = Math.abs(diff); // 20
    const expectedNewTokensUsed = mockTokensUsed + absDiff; // 520

    mockedIncrementTokenUsage.mockResolvedValue(expectedNewTokensUsed);

    await updateTokenUsage(
      mockRedisClient,
      mockTokenUsageConfig.serviceName,
      mockTokenUsageConfig.rateLimiterName,
      mockUserId,
      actualTokens,
      reservedTokens,
      mockWindowStartTimestamp
    );

    expect(mockedIncrementTokenUsage).toHaveBeenCalledWith(
      mockRedisClient,
      mockKey,
      absDiff
    );
    expect(mockedDecrementTokenUsage).not.toHaveBeenCalled();
  });

  it("should handle window mismatch with warning", async () => {
    const actualTokens = 100;
    const reservedTokens = 100;
    const differentWindowStart = 2000000;

    mockedGetTokenUsageState.mockResolvedValue({
      tokensUsed: mockTokensUsed,
      windowStartTimestamp: differentWindowStart,
    });

    await updateTokenUsage(
      mockRedisClient,
      mockTokenUsageConfig.serviceName,
      mockTokenUsageConfig.rateLimiterName,
      mockUserId,
      actualTokens,
      reservedTokens,
      mockWindowStartTimestamp
    );

    // Should still complete without error, but log warning
    expect(mockedGetTokenUsageState).toHaveBeenCalledWith(
      mockRedisClient,
      mockKey,
      mockWindowStartTimestamp
    );
  });
});
