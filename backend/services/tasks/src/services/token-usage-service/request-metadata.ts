import Redis from "ioredis";

import { createLogger } from "@shared/config/create-logger";
import type { RequestMetadata } from "@shared/types";

const logger = createLogger("requestMetadata");

export const REQUEST_METADATA_TTL_SECONDS = 30;
export const REQUEST_METADATA_KEY_PREFIX = "request-metadata:";

export const getRequestMetadataKey = (requestId: string): string => {
  return `${REQUEST_METADATA_KEY_PREFIX}${requestId}`;
};

export const storeRequestMetadata = async (
  redisClient: Redis,
  requestId: string,
  metadata: RequestMetadata,
): Promise<void> => {
  const key = getRequestMetadataKey(requestId);
  const serializedMetadata = JSON.stringify(metadata);

  try {
    await redisClient.setex(
      key,
      REQUEST_METADATA_TTL_SECONDS,
      serializedMetadata,
    );

    logger.debug("Request metadata stored successfully", {
      requestId,
      key,
      ttl: REQUEST_METADATA_TTL_SECONDS,
    });
  } catch (error) {
    logger.error(
      `Failed to store request metadata for requestId: ${requestId}`,
      error,
      { key, requestId, metadata },
    );
  }
};

export const getRequestMetadata = async (
  redisClient: Redis,
  requestId: string,
): Promise<RequestMetadata | null> => {
  const key = getRequestMetadataKey(requestId);
  const serializedMetadata = await redisClient.get(key);

  if (!serializedMetadata) {
    logger.debug("Request metadata not found", { requestId, key });
    return null;
  }

  try {
    const metadata = JSON.parse(serializedMetadata) as RequestMetadata;
    logger.debug("Request metadata retrieved successfully", {
      requestId,
      key,
    });
    return metadata;
  } catch (error) {
    logger.error("Failed to parse request metadata", error, {
      requestId,
      key,
      serializedMetadata,
    });
    return null;
  }
};
