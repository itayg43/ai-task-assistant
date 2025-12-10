import Redis from "ioredis";

import { createLogger } from "../../../config/create-logger";
import { MS_PER_SECOND } from "../../../constants";
import { getCurrentTime } from "../../date-time";
import { getTokenBucketKey } from "../key-utils";
import {
  getTokenUsageState,
  incrementTokenUsage,
  resetTokenUsageWindow,
} from "../token-bucket-state-utils";

const logger = createLogger("processTokenUsage");

type TokenUsageRateLimiterConfig = {
  serviceName: string;
  rateLimiterName: string;
  windowTokensLimit: number;
  windowSizeSeconds: number;
  estimatedTokens: number;
  lockTtlMs: number;
};

type TokenUsageState = {
  allowed: boolean;
  tokensUsed: number;
  tokensReserved: number;
  tokensRemaining: number;
  windowStartTimestamp: number;
};

export const processTokenUsage = async (
  redisClient: Redis,
  config: TokenUsageRateLimiterConfig,
  userId: number
): Promise<TokenUsageState> => {
  const key = getTokenBucketKey(
    config.serviceName,
    config.rateLimiterName,
    userId
  );

  const now = getCurrentTime();
  const windowSizeSecondsMs = config.windowSizeSeconds * MS_PER_SECOND;
  // Calculate current window start: divide time into fixed windows
  // Example: with 24h window (86400000ms), time 100000000ms is in window starting at 86400000ms
  // Formula: floor(now / windowSize) * windowSize gives the start of the current window
  const calculatedWindowStartTimestamp =
    Math.floor(now / windowSizeSecondsMs) * windowSizeSecondsMs;

  let { tokensUsed, windowStartTimestamp } = await getTokenUsageState(
    redisClient,
    key,
    calculatedWindowStartTimestamp
  );

  // Reset if we've moved to a new window (window start changed)
  if (windowStartTimestamp !== calculatedWindowStartTimestamp) {
    logger.info(`Window changed for user ${userId}, resetting token usage`, {
      oldWindowStart: windowStartTimestamp,
      newWindowStart: calculatedWindowStartTimestamp,
    });

    await resetTokenUsageWindow(
      redisClient,
      key,
      calculatedWindowStartTimestamp,
      config.windowSizeSeconds
    );

    tokensUsed = 0;
    windowStartTimestamp = calculatedWindowStartTimestamp;
  }

  const estimatedTokens = config.estimatedTokens;

  logger.info(`Token usage state before processing for user ${userId}`, {
    tokensUsed,
    windowStartTimestamp,
    estimatedTokens,
    windowTokensLimit: config.windowTokensLimit,
  });

  // Check if we have enough tokens remaining
  if (tokensUsed + estimatedTokens > config.windowTokensLimit) {
    const tokensRemaining = Math.max(0, config.windowTokensLimit - tokensUsed);

    logger.warn(
      `Token usage denied request for user ${userId}: not enough tokens`,
      {
        tokensUsed,
        estimatedTokens,
        windowTokensLimit: config.windowTokensLimit,
        tokensRemaining,
      }
    );

    return {
      allowed: false,
      tokensUsed,
      tokensReserved: 0,
      tokensRemaining,
      windowStartTimestamp,
    };
  }

  // Reserve estimated tokens atomically and get the new value
  const newTokensUsed = await incrementTokenUsage(
    redisClient,
    key,
    estimatedTokens
  );
  const tokensRemaining = config.windowTokensLimit - newTokensUsed;

  logger.info(`Token usage allowed request for user ${userId}`, {
    tokensUsed: newTokensUsed,
    tokensReserved: estimatedTokens,
    tokensRemaining,
  });

  return {
    allowed: true,
    tokensUsed: newTokensUsed,
    tokensReserved: estimatedTokens,
    tokensRemaining,
    windowStartTimestamp,
  };
};
