import { createLogger } from "@config/logger";
import { MS_PER_SECOND, TAG } from "@constants";
import { TokenBucketRateLimiterConfig, TokenBucketState } from "@types";
import { getTokenBucketKey } from "@utils/token-bucket/key-utils";
import {
  getTokenBucketState,
  setTokenBucketState,
} from "@utils/token-bucket/token-bucket-state-utils";

const logger = createLogger(TAG.PROCESS_TOKEN_BUCKET);

export const processTokenBucket = async (
  userId: number,
  config: TokenBucketRateLimiterConfig
): Promise<TokenBucketState> => {
  const key = getTokenBucketKey(config.rateLimiterName, userId);

  const now = Date.now();

  let { tokens, last } = await getTokenBucketState(key, config, now);

  // Calculate how much time has passed since the last update (in seconds)
  const elapsed = (now - last) / MS_PER_SECOND;
  // Calculate how many tokens to add based on the elapsed time and refill rate
  const tokensToAdd = elapsed * config.refillRate;
  // Store the previous token count for logging
  const prevTokens = tokens;
  // Add tokens, but do not exceed the bucket's maximum size
  tokens = Math.min(config.bucketSize, tokens + tokensToAdd);

  logger.info(`Token bucket state before processing for user ${userId}`, {
    tokensBefore: prevTokens.toFixed(2),
    tokensToAdd: tokensToAdd.toFixed(2),
    tokensAfterRefill: tokens.toFixed(2),
    elapsed: elapsed.toFixed(2),
  });

  if (tokens < 1) {
    logger.warn(
      `Token bucket denied request for user ${userId}: not enough tokens`
    );

    return {
      allowed: false,
      tokensLeft: Math.max(0, tokens),
    };
  }

  tokens -= 1;

  await setTokenBucketState(key, config, tokens, now);

  logger.info(`Token bucket allowed request for user ${userId}`, {
    tokensLeft: tokens.toFixed(2),
  });

  return {
    allowed: true,
    tokensLeft: tokens,
  };
};
