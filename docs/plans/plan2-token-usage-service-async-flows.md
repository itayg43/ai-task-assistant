# Plan 2: Token Usage Service for Async Flows

## Overview

**Focus**: Implement Redis-based token reconciliation for async operations.

**Dependencies**: Plan 1 (needs `startTime` capture from Plan 1)

**Problem**: After transitioning to async operations, token reservations need to be reconciled when callbacks arrive, but `res.locals` is gone after the request completes.

**Solution**: Store request metadata (tokens + `startTime`) in Redis during request, retrieve and reconcile when callback arrives.

## Token Usage Reconciliation Paths

### Path 1: Immediate Errors (Synchronous) - No Redis Needed

For errors that occur **before** the AI service accepts the request (e.g., prompt injection detected in middleware):

- Error happens synchronously during request
- `res.locals.tokenUsage` is still available
- Use existing `tokenUsageErrorHandler` middleware
- Release full reservation immediately (`actualTokens = 0`)
- No Redis storage required

**Applicable Errors:**
- `PROMPT_INJECTION_DETECTED` - Detected before queueing, no tokens used
- `RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED` - Failed to enqueue, no tokens used

**Note**: This path is already handled by existing `tokenUsageErrorHandler` middleware. No changes needed in this plan.

### Path 2: Async Errors (Asynchronous) - Redis Required

For errors that occur **after** the AI service accepts the request (`202 Accepted`):

- Request accepted, response sent to user
- `res.locals` is gone (request/response cycle complete)
- Must store reservation in Redis during request
- Retrieve and reconcile when callback arrives
- Clean up Redis after reconciliation

**Applicable Errors:**
- `PARSE_TASK_VAGUE_INPUT_ERROR` - OpenAI was called, tokens were used
- `OPENAI_API_ERROR` - OpenAI was called, tokens may have been used
- Success callbacks - Tokens definitely used

**This plan implements Path 2.**

## Implementation Steps

### 1. Create Token Usage Service

#### 1.1 Store Request Metadata

**File**: `backend/services/tasks/src/services/token-usage-service/store-request-metadata.ts`

```typescript
import { redis } from "@clients/redis";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("storeRequestMetadata");

export type RequestMetadata = {
  userId: number;
  tokensReserved: number;
  windowStartTimestamp: number;
  startTime: number; // ✅ Include startTime for metrics (from Plan 1)
  serviceName: string;
  rateLimiterName: string;
  createdAt: number;
};

export const storeRequestMetadata = async (
  requestId: string,
  metadata: Omit<RequestMetadata, "createdAt">
): Promise<void> => {
  const key = `request-metadata:${requestId}`;
  const fullMetadata: RequestMetadata = {
    ...metadata,
    createdAt: Date.now(),
  };

  // Simple SET - no lock needed (unique key, idempotent)
  // TTL: 1 hour (should be enough for callback to arrive)
  await redis.setex(key, 3600, JSON.stringify(fullMetadata));

  logger.info("Stored request metadata", {
    requestId,
    userId: metadata.userId,
    tokensReserved: metadata.tokensReserved,
    startTime: metadata.startTime,
  });
};
```

#### 1.2 Get Request Metadata (Optional Helper)

**File**: `backend/services/tasks/src/services/token-usage-service/get-request-metadata.ts`

```typescript
import { redis } from "@clients/redis";
import { createLogger } from "@shared/config/create-logger";
import type { RequestMetadata } from "./store-request-metadata";

const logger = createLogger("getRequestMetadata");

export const getRequestMetadata = async (
  requestId: string
): Promise<RequestMetadata | null> => {
  const key = `request-metadata:${requestId}`;
  const data = await redis.get(key);

  if (!data) {
    logger.debug("Request metadata not found", { requestId });
    return null;
  }

  return JSON.parse(data) as RequestMetadata;
};
```

#### 1.3 Reconcile Token Usage from Callback

**File**: `backend/services/tasks/src/services/token-usage-service/reconcile-token-usage-from-callback.ts`

```typescript
import { redis } from "@clients/redis";
import { redlock } from "@clients/redlock";
import { createLogger } from "@shared/config/create-logger";
import { getTokenBucketLockKey } from "@shared/utils/token-bucket/key-utils";
import { updateTokenUsage as updateTokenUsageUtil } from "@shared/utils/token-bucket/update-token-usage";
import { withLock } from "@shared/utils/with-lock";
import type { RequestMetadata } from "./store-request-metadata";

const logger = createLogger("reconcileTokenUsageFromCallback");

export type ReconcileResult = {
  startTime?: number; // ✅ Return startTime for metrics (used in Plan 1)
};

export const reconcileTokenUsageFromCallback = async (
  requestId: string,
  actualTokens: number,
  lockTtlMs: number
): Promise<ReconcileResult> => {
  const metadataKey = `request-metadata:${requestId}`;
  const metadataData = await redis.get(metadataKey);

  if (!metadataData) {
    logger.warn("Request metadata not found for callback", { requestId });
    return {};
  }

  const metadata: RequestMetadata = JSON.parse(metadataData);

  // ✅ Only reconcile tokens if tokens were actually reserved
  if (metadata.tokensReserved > 0 && metadata.rateLimiterName) {
    // Use with-lock for token bucket modification (atomic operation)
    const lockKey = getTokenBucketLockKey(
      metadata.serviceName,
      metadata.rateLimiterName,
      metadata.userId
    );

    await withLock(
      redlock,
      lockKey,
      lockTtlMs,
      async () => {
        return await updateTokenUsageUtil(
          redis,
          metadata.serviceName,
          metadata.rateLimiterName,
          metadata.userId,
          actualTokens,
          metadata.tokensReserved,
          metadata.windowStartTimestamp
        );
      },
      {
        requestId,
        operation: "reconcileTokenUsageFromCallback",
      }
    );

    logger.info("Reconciled token usage from callback", {
      requestId,
      userId: metadata.userId,
      actualTokens,
      tokensReserved: metadata.tokensReserved,
      startTime: metadata.startTime,
    });
  } else {
    // No token reconciliation needed (metrics-only storage)
    logger.debug("No token reconciliation needed (metrics-only)", {
      requestId,
      startTime: metadata.startTime,
    });
  }

  // Clean up metadata
  await redis.del(metadataKey);

  // ✅ Return startTime for metrics recording (always, even if no tokens)
  return { startTime: metadata.startTime };
};
```

#### 1.4 Service Index

**File**: `backend/services/tasks/src/services/token-usage-service/index.ts`

```typescript
export { storeRequestMetadata } from "./store-request-metadata";
export type { RequestMetadata } from "./store-request-metadata";
export { getRequestMetadata } from "./get-request-metadata";
export { reconcileTokenUsageFromCallback } from "./reconcile-token-usage-from-callback";
export type { ReconcileResult } from "./reconcile-token-usage-from-callback";
```

### 2. Update Tasks Controller to Store Metadata

**File**: `backend/services/tasks/src/controllers/tasks-controller.ts`

```typescript
// controllers/tasks-controller.ts - POST (async)
import { StatusCodes } from "http-status-codes";
import { Request, Response, NextFunction } from "express";

import { TASKS_OPERATION } from "@constants";
import { getStartTimestamp } from "@shared/utils/performance";
import { storeRequestMetadata } from "@services/token-usage-service";
import { recordTasksApiFailure } from "@metrics/tasks-metrics";
import { getAuthenticationContext } from "@shared/middlewares/authentication";
import { env } from "@config/env";
// ... other imports (createTaskHandler, etc.)

export const createTask = async (
  req: Request,
  res: Response<CreateTaskResponse>,
  next: NextFunction
) => {
  const { requestId } = res.locals;
  const { naturalLanguage } = req.body;
  const startTime = getStartTimestamp(); // ✅ From Plan 1

  try {
    const message = await createTaskHandler(requestId, naturalLanguage);

    // ✅ Only reached if AI service returned 202 Accepted
    // ✅ Store ALL metadata in Redis (tokens + startTime)
    const tokenUsage = res.locals.tokenUsage;
    if (tokenUsage) {
      const { userId } = getAuthenticationContext(res);
      await storeRequestMetadata(requestId, {
        userId,
        tokensReserved: tokenUsage.tokensReserved,
        windowStartTimestamp: tokenUsage.windowStartTimestamp,
        startTime, // ✅ Store startTime with token metadata
        serviceName: env.SERVICE_NAME,
        rateLimiterName: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_NAME,
      });
    }

    res.status(StatusCodes.ACCEPTED).json({
      message,
      tasksServiceRequestId: requestId,
    });

    // ✅ Don't record metrics here - will be recorded in webhook callback (Plan 1)
  } catch (error) {
    // ❌ Prompt injection comes here - BEFORE 202
    // ❌ Never reaches storeRequestMetadata
    // ✅ res.locals.tokenUsage still available
    // ✅ tokenUsageErrorHandler will release it (existing middleware)
    // ✅ Record failure for immediate errors (Plan 1)
    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, requestId);
    next(error);
  }
};
```

### 3. Update Callback URL Format

**File**: `backend/services/tasks/src/services/tasks-service.ts`

```typescript
// services/tasks-service.ts - Only requestId in callback URL
export const createTaskHandler = async (
  requestId: string,
  naturalLanguage: string
): Promise<string> => {
  // ✅ Only include requestId in callback URL (startTime stored in Redis)
  const baseCallbackUrl = "http://tasks:3001/api/v1/webhooks/create-task";
  const callbackUrl = `${baseCallbackUrl}?requestId=${requestId}`;

  const { message } = await executeCapability<"parse-task">(requestId, {
    capability: "parse-task",
    callbackUrl, // Only requestId
    params: {
      naturalLanguage,
      config: DEFAULT_PARSE_TASK_CONFIG,
    },
  });

  return message;
};
```

**Note**: Remove any `startTime` from callback URL if it was previously included. Only `requestId` should be in the URL.

### 4. Update Tasks Webhook Controller

**File**: `backend/services/tasks/src/controllers/webhooks-controller.ts`

```typescript
// controllers/webhooks-controller.ts - Record actual completion
import { StatusCodes } from "http-status-codes";
import { Request, Response } from "express";

import { TASKS_OPERATION } from "@constants";
import {
  recordTasksApiSuccess,
  recordTasksApiFailure,
} from "@metrics/tasks-metrics";
import { getElapsedDuration } from "@shared/utils/performance";
import { createLogger } from "@shared/config/create-logger";
import { reconcileTokenUsageFromCallback } from "@services/token-usage-service";
import { getAuthenticationContext } from "@shared/middlewares/authentication";
import { extractOpenaiTokenUsage } from "@utils/extract-openai-token-usage";
import { env } from "@config/env";
import { createTaskHandler } from "@services/tasks-service";

const logger = createLogger("webhooksController");

export const createTask = async (req: Request, res: Response, _next) => {
  const { userId } = getAuthenticationContext(res);
  const { aiServiceRequestId, success } = req.body;
  const requestId = req.query.requestId as string;

  // ✅ Validate requestId
  if (!requestId) {
    logger.error("Missing requestId in callback", { aiServiceRequestId });
    res.sendStatus(StatusCodes.OK);
    return;
  }

  try {
    if (!success) {
      const { error } = req.body;

      // ✅ Record actual failure (no duration) - from Plan 1
      try {
        recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, requestId);
      } catch (metricsError) {
        logger.error("Failed to record failure metrics", metricsError, {
          requestId,
        });
      }

      // Note: Error-specific metrics will be added in Plan 3

      // ✅ Token usage reconciliation (returns startTime from Redis)
      try {
        const actualTokens = error.context?.openaiMetadata
          ? extractOpenaiTokenUsage(error.context.openaiMetadata)
          : 0;
        await reconcileTokenUsageFromCallback(
          requestId,
          actualTokens,
          env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS
        );
        // Note: startTime retrieved but not used for failure metrics (no duration)
      } catch (tokenError) {
        logger.error("Failed to reconcile token usage", tokenError, {
          requestId,
        });
      }

      return;
    }

    // Success path
    const { result } = req.body;
    await createTaskHandler(userId, result.result);

    // ✅ Token usage reconciliation (returns startTime from Redis)
    let startTime: number | undefined;
    try {
      const actualTokens = extractOpenaiTokenUsage(result.openaiMetadata);
      const reconcileResult = await reconcileTokenUsageFromCallback(
        requestId,
        actualTokens,
        env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS
      );
      startTime = reconcileResult.startTime; // ✅ Get startTime from Redis
    } catch (tokenError) {
      logger.error("Failed to reconcile token usage", tokenError, {
        requestId,
      });
    }

    // ✅ Record actual success with total duration (if startTime available) - from Plan 1
    try {
      if (startTime && !isNaN(startTime)) {
        const totalDuration = getElapsedDuration(startTime);
        recordTasksApiSuccess(
          TASKS_OPERATION.CREATE_TASK,
          totalDuration,
          requestId
        );
      } else {
        // Record without duration if startTime missing
        recordTasksApiSuccess(TASKS_OPERATION.CREATE_TASK, 0, requestId);
      }
    } catch (metricsError) {
      logger.error("Failed to record success metrics", metricsError, {
        requestId,
      });
    }
  } catch (error) {
    logger.error("Failed to process webhook callback", error, {
      aiServiceRequestId,
      requestId,
    });

    // ✅ Record failure for webhook processing errors - from Plan 1
    // Note: This is different from callback errors - this is a system error
    if (requestId) {
      try {
        recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, requestId);
      } catch (metricsError) {
        logger.error("Failed to record failure metrics", metricsError, {
          requestId,
        });
      }
    }
  } finally {
    res.sendStatus(StatusCodes.OK);
  }
};
```

## Test Specifications

### New Test Files to Create

#### 1. `services/token-usage-service/store-request-metadata.test.ts` (Unit test)

**Test Structure:**
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
- Mock Redis client using `vi.mock()` at module level
- Use `Mocked<T>` for Redis client type
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)

**Test Cases:**
- ✅ Stores metadata in Redis with correct key format: `request-metadata:${requestId}`
- ✅ Sets TTL to 3600 seconds (1 hour)
- ✅ Includes createdAt timestamp in stored metadata
- ✅ Handles metrics-only storage (zero tokens, empty rateLimiterName)
- ✅ Validates JSON serialization/deserialization

**Mock Patterns:**
- Mock Redis client using `createRedisClientMock()` factory or `vi.mock()`
- Use `Mocked<T>` for Redis client type
- Verify `redis.setex()` called with correct key, TTL, and JSON string

#### 2. `services/token-usage-service/get-request-metadata.test.ts` (Unit test)

**Test Structure:**
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
- Mock Redis client using `vi.mock()` at module level
- Use `Mocked<T>` for Redis client type
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)

**Test Cases:**
- ✅ Retrieves and parses metadata from Redis
- ✅ Returns null when metadata not found (logs debug)
- ✅ Handles invalid JSON gracefully (throws error)

**Mock Patterns:**
- Mock Redis client using `createRedisClientMock()` factory or `vi.mock()`
- Use `Mocked<T>` for Redis client type
- Test `redis.get()` returning `null` (not found) and valid JSON strings

#### 3. `services/token-usage-service/reconcile-token-usage-from-callback.test.ts` (Unit test)

**Test Structure:**
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
- Mock Redis client, Redlock, and `withLock` using `vi.mock()` at module level
- Use `Mocked<T>` for all mock types
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)
- Use nested `describe` blocks for different scenarios

**Test Cases:**
- ✅ Retrieves metadata, reconciles tokens using `withLock`, and returns startTime
- ✅ Handles metrics-only storage (no token reconciliation, still returns startTime)
- ✅ Returns empty object when metadata not found (logs warning)
- ✅ Still returns startTime even if token reconciliation fails
- ✅ Cleans up Redis key after reconciliation
- ✅ Handles Redis get failure gracefully
- ✅ Uses correct lock key format from `getTokenBucketLockKey`

**Mock Patterns:**
- Mock Redis client, Redlock, `withLock`, and `getTokenBucketLockKey` using `vi.mock()`
- Use `Mocked<T>` for all mock types
- Verify `withLock` called with correct lock key and callback
- Verify `redis.del()` called after reconciliation
- Use `it.each()` for multiple scenarios (with/without tokens, found/not found)

### Existing Test Files to Update

#### 1. `controllers/tasks-controller/tasks-controller.unit.test.ts` (Unit test)

**createTask**: Add/update tests for:
- ✅ Stores metadata in Redis after successful handler call (only if tokenUsage exists)
- ✅ Doesn't store metadata if tokenUsage not available
- ✅ Doesn't store metadata if handler throws (before 202)
- ✅ Mock `storeRequestMetadata` and verify call with correct parameters

**Mock Patterns:**
- Mock `storeRequestMetadata` using `vi.mock()`
- Use `Mocked<T>` for service dependencies
- Verify mocks called with correct parameters using `.toHaveBeenCalledWith()`

#### 2. `controllers/tasks-controller/tasks-controller.integration.test.ts` (Integration test)

**Test Cases:**
- ✅ Verify `storeRequestMetadata` is called after successful AI service call
- ✅ Verify metadata stored with correct structure (tokens + startTime)

**Mock Patterns:**
- Mock external services (AI service, Redis) at module level using `vi.mock()`
- Use `supertest` for HTTP endpoint testing
- Verify `storeRequestMetadata` called with correct parameters

#### 3. `controllers/webhooks-controller/webhooks-controller.test.ts` (Unit test)

**Test Structure:**
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
- Declare mock variables at top: `let mockRequest: Partial<Request>; let mockResponse: Partial<Response>;`
- Initialize mocks in `beforeEach` with default values
- Use `Mocked<T>` for service dependencies
- Use `ReturnType<typeof vi.fn>` for Express `NextFunction`
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)
- Use nested `describe` blocks for success/error paths

**Test Cases:**
- ✅ Success path: processes callback, reconciles tokens, records success metrics with duration
- ✅ Records metrics without duration if startTime missing from reconciliation
- ✅ Error callback: reconciles tokens (uses 0 tokens if no openaiMetadata)
- ✅ Handles error callback without openaiMetadata (uses 0 tokens)
- ✅ Returns 200 and logs error if requestId missing from query
- ✅ Handles token reconciliation failures gracefully (try-catch)
- ✅ Returns startTime from reconciliation even if token reconciliation fails

**Mock Patterns:**
- Mock Express request/response directly in `beforeEach` (not using factories)
- Mock `reconcileTokenUsageFromCallback`, `recordTasksApiSuccess`, `recordTasksApiFailure` using `vi.mock()`
- Use `Mocked<T>` for service dependencies
- Use `ReturnType<typeof vi.fn>` for `NextFunction`
- Verify `res.sendStatus()` called with `StatusCodes.OK`
- Use `it.each()` for multiple error scenarios

## Key Implementation Points

- **Store metadata after 202 Accepted**: Only store if AI service accepts request
- **Include `startTime` in metadata**: Required for metrics (from Plan 1)
- **TTL on Redis keys**: Set expiration (1 hour) to prevent bloat
- **Locking strategy**: 
  - Storage: No lock needed (simple SET with unique key, idempotent)
  - Reconciliation: Use `with-lock` (modifies token bucket atomically)
- **Callback URL format**: Only include `requestId` (startTime stored in Redis)
- **Handle missing metadata gracefully**: Log warning, return empty object, don't fail callback
- **Return `startTime` from reconciliation**: Always return `startTime` even if no token reconciliation needed
- **Clean up Redis after reconciliation**: Delete metadata key after processing
- **Metrics-only storage**: Support storing metadata even when no tokens reserved (for metrics)

## Success Criteria

- [ ] Token usage service created (`storeRequestMetadata`, `getRequestMetadata`, `reconcileTokenUsageFromCallback`)
- [ ] Tasks controller stores metadata after successful AI service call
- [ ] Callback URL format updated (only `requestId`)
- [ ] Tasks webhook reconciles tokens and retrieves `startTime` from Redis
- [ ] Metrics recording uses `startTime` from reconciliation (Plan 1 integration)
- [ ] All tests pass
- [ ] Handle missing metadata gracefully
- [ ] Redis keys cleaned up after reconciliation
