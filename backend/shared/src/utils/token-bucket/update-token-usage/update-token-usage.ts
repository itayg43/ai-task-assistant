import Redis from "ioredis";

import { createLogger } from "../../../config/create-logger";
import { getTokenBucketKey } from "../key-utils";
import {
  decrementTokenUsage,
  getTokenUsageState,
  incrementTokenUsage,
} from "../token-usage-state-utils";

const logger = createLogger("updateTokenUsage");

export const updateTokenUsage = async (
  redisClient: Redis,
  serviceName: string,
  rateLimiterName: string,
  userId: number,
  actualTokens: number,
  reservedTokens: number,
  windowStartTimestamp: number
): Promise<void> => {
  const key = getTokenBucketKey(serviceName, rateLimiterName, userId);

  const { tokensUsed, windowStartTimestamp: currentWindowStart } =
    await getTokenUsageState(redisClient, key, windowStartTimestamp);

  // Safety check: window might have changed if request duration exceeded window size
  if (currentWindowStart !== windowStartTimestamp) {
    logger.warn(
      `Window mismatch for user ${userId} during token usage update`,
      {
        expectedWindow: windowStartTimestamp,
        currentWindow: currentWindowStart,
        actualTokens,
        reservedTokens,
      }
    );
  }

  const diff = reservedTokens - actualTokens;

  if (diff === 0) {
    logger.info(`Token usage update for user ${userId}: no adjustment needed`, {
      actualTokens,
      reservedTokens,
      tokensUsed,
    });

    return;
  }

  if (diff > 0) {
    const newTokensUsed = await decrementTokenUsage(redisClient, key, diff);

    logger.info(
      `Token usage update for user ${userId}: released excess tokens`,
      {
        actualTokens,
        reservedTokens,
        diff,
        tokensUsedBefore: tokensUsed,
        tokensUsedAfter: newTokensUsed,
      }
    );

    return;
  }

  if (diff < 0) {
    const absDiff = Math.abs(diff);
    const newTokensUsed = await incrementTokenUsage(redisClient, key, absDiff);

    logger.warn(
      `Token usage update for user ${userId}: actual tokens exceeded reserved`,
      {
        actualTokens,
        reservedTokens,
        diff: absDiff,
        tokensUsedBefore: tokensUsed,
        tokensUsedAfter: newTokensUsed,
      }
    );

    return;
  }
};
