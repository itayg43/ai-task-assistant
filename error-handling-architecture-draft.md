# Error Handling Architecture - Async Flow

## Problem Statement

After transitioning from synchronous to asynchronous capability execution, we need to handle errors in two distinct contexts:

1. **Request Path (Synchronous)**: Errors that occur when calling the AI service

   - `PROMPT_INJECTION_DETECTED` - Detected in AI service middleware before queueing
   - `RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED` - When enqueueing fails
   - These errors never reach callbacks

2. **Callback Path (Asynchronous)**: Errors that occur during capability execution
   - `PARSE_TASK_VAGUE_INPUT_ERROR` - Detected in AI worker after OpenAI responds
   - `OPENAI_API_ERROR` - OpenAI API failures during capability execution
   - Other capability execution errors

The current `tasksErrorHandler` middleware only covers the request path. Callback errors need separate handling.

## Key Requirements

1. **Different error types occur in different contexts** - cannot use same handler for all
2. **Separation of concerns** - metrics, logging, and token usage should be decoupled
3. **Composable architecture** - handlers should be independent and reusable

## Proposed Architecture

### Design Principles

- **Separation of Concerns**: Error handling, metrics, token usage, and logging are independent modules
- **Context-Aware**: Request vs callback errors handled where they occur
- **Composable**: Services can be mixed and matched as needed
- **Testable**: Each service can be tested independently

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Error Type Handlers                        │
│  (Pure functions - no side effects)                     │
│  - handleVagueInputError(errorInfo)                    │
│  - handlePromptInjectionError(errorInfo)               │
│  - handleRabbitMQError(errorInfo)                      │
│  - handleOpenAIError(errorInfo)                        │
│  Returns: { userMessage, suggestions?, httpStatus }   │
└─────────────────────────────────────────────────────────┘
           ▲                          ▲
           │                          │
    ┌──────┴──────┐          ┌────────┴────────┐
    │             │          │                 │
┌───┴──────┐  ┌───┴──────┐  ┌┴──────────────┐ │
│ Metrics │  │ Tokens   │  │ Logging       │ │
│ Service │  │ Service  │  │ (Logger)      │ │
│         │  │          │  │                │ │
└─────────┘  └──────────┘  └────────────────┘ │
```

## Implementation Structure

### 1. Error Type Handlers (`services/error-handlers/`)

Pure functions that map error types to user-facing responses. No side effects.

**Files:**

- `error-handlers/vague-input-error-handler.ts`
- `error-handlers/prompt-injection-error-handler.ts`
- `error-handlers/rabbitmq-error-handler.ts`
- `error-handlers/openai-error-handler.ts`
- `error-handlers/index.ts` - Router function

**Example:**

```typescript
// error-handlers/vague-input-error-handler.ts
import { StatusCodes } from "http-status-codes";

import { ExtractedErrorInfo } from "@shared/types";
import { TAiParseTaskVagueInputErrorData } from "@types";

export type ErrorHandlerResult = {
  userMessage: string;
  suggestions?: string[];
  httpStatus: number;
};

export const handleVagueInputError = (
  errorInfo: ExtractedErrorInfo
): ErrorHandlerResult => {
  const errorData = errorInfo.context as TAiParseTaskVagueInputErrorData;
  return {
    userMessage: errorData.message,
    suggestions: errorData.suggestions,
    httpStatus: StatusCodes.BAD_REQUEST,
  };
};

// error-handlers/index.ts - Router function
import { AI_ERROR_TYPE } from "@constants";
import { ExtractedErrorInfo } from "@shared/types";
import { handleVagueInputError } from "./vague-input-error-handler";
import { handlePromptInjectionError } from "./prompt-injection-error-handler";
// ... other handlers
import type { ErrorHandlerResult } from "./vague-input-error-handler";

export const handleAiError = (
  errorInfo: ExtractedErrorInfo
): ErrorHandlerResult | null => {
  const errorType = errorInfo.context?.type;
  if (!errorType) return null;

  switch (errorType) {
    case AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR:
      return handleVagueInputError(errorInfo);
    case AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED:
      return handlePromptInjectionError(errorInfo);
    // ... other handlers
    default:
      return null;
  }
};
```

### 2. Metrics Service (`services/metrics-service/`)

Independent metrics recording. **Critical change**: Remove metrics middleware, use manual metrics recording for all operations.

#### Metrics Recording Strategy

**Problem**: Metrics middleware records on `res.finish`, which doesn't work for async operations:

- Sync operations (GET): Complete immediately → middleware works
- Async operations (POST → 202): Response finishes immediately, but operation completes later → middleware records false "success"

**Solution**: Fully manual metrics recording

- **Sync operations**: Use `withMetrics` helper function
- **Async operations**: Manual recording in callback/worker with startTime passed through

**Files:**

- `shared/utils/with-metrics/with-metrics.ts` - Helper for sync operations
- `services/metrics-service/record-error-metrics.ts` - Error-specific metrics
- `services/metrics-service/record-api-metrics.ts` - API-level metrics (optional helper)

**TODO: Remove Existing Metrics Middleware Code**

- [ ] Remove `tasksMetricsMiddleware` from `backend/services/tasks/src/routers/index.ts`
- [ ] Remove `aiMetricsMiddleware` from `backend/services/ai/src/routers/index.ts` (if exists)
- [ ] Delete `backend/services/tasks/src/middlewares/metrics-middleware/` directory
- [ ] Delete `backend/services/ai/src/middlewares/metrics-middleware/` directory (if exists)
- [ ] Remove `createMetricsMiddleware` usage from shared code (if only used by these services)
- [ ] Update tests that rely on metrics middleware

**Example Implementation:**

```typescript
// shared/utils/with-metrics/with-metrics.ts
import {
  getStartTimestamp,
  getElapsedDuration,
} from "@shared/utils/performance";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("withMetrics");

export type MetricsRecorder<T> = {
  recordSuccess: (operation: T, durationMs: number, requestId: string) => void;
  recordFailure: (operation: T, requestId: string) => void;
};

export const withMetrics = async <TOperation, TReturn>(
  operation: TOperation,
  requestId: string,
  recorder: MetricsRecorder<TOperation>,
  fn: (startTime: number) => Promise<TReturn>
): Promise<TReturn> => {
  const startTime = getStartTimestamp();

  try {
    const result = await fn(startTime);
    const duration = getElapsedDuration(startTime);
    recorder.recordSuccess(operation, duration, requestId);

    logger.debug("Recorded success metrics", {
      operation,
      requestId,
      duration,
    });

    return result;
  } catch (error) {
    recorder.recordFailure(operation, requestId);

    logger.debug("Recorded failure metrics", {
      operation,
      requestId,
    });

    throw error;
  }
};

// services/metrics-service/record-error-metrics.ts
import { AI_ERROR_TYPE } from "@constants";
import {
  recordVagueInput,
  recordPromptInjection,
} from "@metrics/tasks-metrics";
import { TasksOperation } from "@types";

export const recordAiErrorMetrics = (
  errorType: string,
  requestId: string,
  operation?: TasksOperation
): void => {
  switch (errorType) {
    case AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR:
      recordVagueInput(requestId);
      break;
    case AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED:
      if (operation) {
        recordPromptInjection(operation, requestId);
      }
      break;
    // ... other error metrics
  }
};
```

**Usage - Sync Operations (GET):**

```typescript
// controllers/tasks-controller.ts - GET (sync)
import { StatusCodes } from "http-status-codes";
import { Request, Response, NextFunction } from "express";

import { TASKS_OPERATION } from "@constants";
import { withMetrics } from "@shared/utils/with-metrics";
import { recordTasksApiSuccess, recordTasksApiFailure } from "@metrics/tasks-metrics";
import { getAuthenticationContext } from "@shared/middlewares/authentication";
import { getValidatedQuery } from "@shared/middlewares/validate-schema";
// ... other imports (getTasksHandler, taskToResponseDto, etc.)

export const getTasks = async (
  _req: Request,
  res: Response<GetTasksResponse>,
  next: NextFunction
) => {
  const { requestId } = res.locals;
  const { userId } = getAuthenticationContext(res);
  const query = getValidatedQuery<GetTasksInput["query"]>(res);

  // ✅ Use withMetrics helper for sync operations
  await withMetrics(
    TASKS_OPERATION.GET_TASKS,
    requestId,
    {
      recordSuccess: recordTasksApiSuccess,
      recordFailure: recordTasksApiFailure,
    },
    async (startTime) => {
      const result = await getTasksHandler(userId, query);
      const response: GetTasksResponse = {
        tasksServiceRequestId: requestId,
        tasks: result.tasks.map(taskToResponseDto),
        pagination: { ... },
      };

      res.status(StatusCodes.OK).json(response);
      return response;
    }
  ).catch(next);
};
```

**Usage - Async Operations (POST):**

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
  const startTime = getStartTimestamp(); // ✅ Capture start time

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

    // ✅ Don't record metrics here - will be recorded in webhook callback
  } catch (error) {
    // ✅ Record failure for immediate errors (prompt injection, etc.)
    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, requestId);
    next(error);
  }
};

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
import { recordAiErrorMetrics } from "@services/metrics-service";
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

      // ✅ Record actual failure (no duration)
      try {
        recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, requestId);
      } catch (metricsError) {
        logger.error("Failed to record failure metrics", metricsError, {
          requestId,
        });
      }

      // Record error-specific metrics
      try {
        recordAiErrorMetrics(
          error.context?.type,
          requestId,
          TASKS_OPERATION.CREATE_TASK
        );
      } catch (metricsError) {
        logger.error("Failed to record error metrics", metricsError, {
          requestId,
        });
      }

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

    // ✅ Record actual success with total duration (if startTime available)
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

    // ✅ Record failure for webhook processing errors
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

**AI Service Usage:**

**Important**: Metrics are recorded **BEFORE** callback delivery to measure AI service performance independently of callback delivery. The `sendCallbackHandler` helper handles message ack/nack based on callback success/failure.

```typescript
// controllers/capabilities-controller.ts - POST (async)
import { StatusCodes } from "http-status-codes";
import { Request, Response, NextFunction } from "express";

import { getStartTimestamp } from "@shared/utils/performance";
import { recordAiApiFailure } from "@metrics/ai-service-metrics";
import { RABBITMQ_QUEUE } from "@constants";
// ... other imports (sendMessageToRabbitMQQueue, getCapabilityConfig, etc.)

export const executeCapability = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = res.locals.requestId;
  const config = getCapabilityConfig(res);
  const input = getCapabilityValidatedInput(res);
  const { callbackUrl } = getCapabilityValidatedQuery(res);
  const startTime = getStartTimestamp(); // ✅ Capture start time

  try {
    // ✅ Include startTime in queue message (no Redis needed - worker gets it from message)
    await sendMessageToRabbitMQQueue(RABBITMQ_QUEUE.CAPABILITIES, {
      requestId,
      capability: config.name,
      input,
      callbackUrl,
      startTime, // ✅ Include startTime in queue message (internal, for worker metrics)
    });

    res.status(StatusCodes.ACCEPTED).json({
      message: "The request has been received and will be executed shortly.",
      aiServiceRequestId: requestId,
    });

    // ✅ Don't record metrics here - will be recorded in worker
  } catch (error) {
    // ✅ Record failure for immediate errors (RabbitMQ send failure)
    recordAiApiFailure(config.name, requestId);
    next(error);
  }
};

// workers/capabilities-worker.ts - Record actual completion
import {
  recordAiApiSuccess,
  recordAiApiFailure,
} from "@metrics/ai-service-metrics";
import { getElapsedDuration } from "@shared/utils/performance";
import { createLogger } from "@shared/config/create-logger";
import { extractErrorInfo } from "@shared/utils/extract-error-info";
import { BadRequestError } from "@shared/errors";
import { capabilities } from "@capabilities";
const logger = createLogger("capabilitiesWorker");

// Note: sendCallbackHandler is an existing helper function in the same file that:
// - Sends HTTP callback to Tasks service via tasksClient.post()
// - Handles retries with DEFAULT_RETRY_CONFIG
// - Acks message on successful callback delivery
// - Nacks message (no retry) on callback delivery failure
// See actual implementation in capabilities-worker.ts for full details

const capabilitiesMessageHandler = async (channel, message) => {
  let reqId: string | undefined;
  let cbUrl: string | undefined;
  let capability: string | undefined;

  try {
    const parsedMessageData = parseMessageData(message);
    if (!parsedMessageData) {
      channel.nack(message, false, false);
      return;
    }

    const {
      requestId,
      capability: cap,
      input,
      callbackUrl,
      startTime: msgStartTime,
    } = parsedMessageData;
    reqId = requestId;
    cbUrl = callbackUrl;
    capability = cap;
    const startTime = msgStartTime; // ✅ Get startTime directly from queue message

    // ✅ Validate startTime
    if (!startTime || isNaN(startTime)) {
      logger.warn("Missing or invalid startTime in queue message", {
        requestId,
        capability,
      });
    }

    const config = capabilities[capability];
    if (!config) {
      throw new BadRequestError(`Capability ${capability} not found`);
    }

    const validatedInput = config.inputSchema.parse(input);
    const result = await executeCapabilityHandler(
      requestId,
      config,
      validatedInput
    );

    // ✅ Record success AFTER capability execution, BEFORE callback
    // This measures AI service performance, not callback delivery
    try {
      if (startTime && !isNaN(startTime)) {
        const totalDuration = getElapsedDuration(startTime);
        recordAiApiSuccess(capability, totalDuration, requestId);
      } else {
        // Record success without duration
        recordAiApiSuccess(capability, 0, requestId);
      }
    } catch (metricsError) {
      logger.error("Failed to record success metrics", metricsError, {
        requestId,
        capability,
      });
    }

    // Send callback (sendCallbackHandler handles ack on success, nack on failure)
    // Note: sendCallbackHandler acks the message after successful callback delivery
    // If callback fails, it nacks the message (no retry)
    await sendCallbackHandler(channel, message, requestId, callbackUrl, {
      success: true,
      result,
    });
  } catch (error) {
    const errorInfo = extractErrorInfo(error);

    // ✅ Record failure for capability execution errors (before callback)
    try {
      if (capability && reqId) {
        recordAiApiFailure(capability, reqId);
      }
    } catch (metricsError) {
      logger.error("Failed to record failure metrics", metricsError, {
        requestId: reqId,
        capability,
      });
    }

    // Send error callback (sendCallbackHandler handles ack on success, nack on failure)
    // Note: sendCallbackHandler acks the message after successful callback delivery
    // If callback fails, it nacks the message (no retry)
    if (cbUrl) {
      await sendCallbackHandler(channel, message, reqId, cbUrl, {
        success: false,
        error: errorInfo,
      });
    } else {
      // No callback URL - ack message to prevent redelivery
      channel.ack(message);
    }
  }
};
```

**Schema Updates:**

```typescript
// schemas/capabilities-queue-message.ts (AI Service)
export const capabilitiesQueueMessageDataSchema = z.object({
  requestId: z.string(),
  capability: z.string(),
  input: z.unknown(),
  callbackUrl: z.string(),
  startTime: z.number(), // ✅ Include startTime in queue message (internal, for worker metrics)
});

// Note: Tasks service callback URL only includes requestId (external-facing)
// Tasks service stores startTime in Redis with token metadata (for token reconciliation)
// AI service queue message includes startTime (internal, acceptable - no Redis needed)
```

**Test Specifications:**

#### New Test Files to Create

1. **`shared/utils/with-metrics/with-metrics.test.ts`** (Unit test)

   **Test Structure:**

   - Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
   - Declare mock variables at top: `let mockRecorder: Mocked<MetricsRecorder<...>>`
   - Initialize mocks in `beforeEach` with default values
   - Use `vi.clearAllMocks()` in `afterEach` (mocks are used)
   - Follow Arrange-Act-Assert pattern

   **Test Cases:**

   - ✅ Records success on successful execution with correct duration
   - ✅ Records failure on error (no duration)
   - ✅ Passes startTime to the function
   - ✅ Handles metrics recording failures gracefully (doesn't break flow)
   - ✅ Re-throws original error after recording failure metrics
   - ✅ Uses `getStartTimestamp` and `getElapsedDuration` correctly

   **Mock Patterns:**

   - Mock `getStartTimestamp` and `getElapsedDuration` using `vi.mock()`
   - Use `Mocked<T>` for `MetricsRecorder` type
   - Use `vi.mocked()` for properly typed mock functions

2. **`services/token-usage-service/store-request-metadata.test.ts`** (Unit test)

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

3. **`services/token-usage-service/get-request-metadata.test.ts`** (Unit test)

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

4. **`services/token-usage-service/reconcile-token-usage-from-callback.test.ts`** (Unit test)

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

5. **`services/metrics-service/record-error-metrics.test.ts`** (Unit test)

   **Test Structure:**

   - Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
   - Mock metrics functions using `vi.mock()` at module level
   - Use `Mocked<T>` for metrics function types
   - Use `vi.clearAllMocks()` in `afterEach` (mocks are used)
   - Use `it.each()` for multiple error types

   **Test Cases:**

   - ✅ Records vague input error via `recordVagueInput`
   - ✅ Records prompt injection error with operation via `recordPromptInjection`
   - ✅ Doesn't record prompt injection if operation not provided
   - ✅ Handles unknown error types gracefully (no-op)

   **Mock Patterns:**

   - Mock `recordVagueInput` and `recordPromptInjection` using `vi.mock()`
   - Use `Mocked<T>` for metrics function types
   - Verify correct metrics function called with correct parameters
   - Verify no metrics called for unknown error types

6. **`controllers/webhooks-controller/webhooks-controller.test.ts`** (Unit test)

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
   - ✅ Error callback: records failure and error-specific metrics, reconciles tokens
   - ✅ Handles error callback without openaiMetadata (uses 0 tokens)
   - ✅ Returns 200 and logs error if requestId missing from query
   - ✅ Records failure metric if webhook processing fails (catch block)
   - ✅ Handles metrics recording failures gracefully (try-catch around metrics)
   - ✅ Handles token reconciliation failures gracefully (try-catch)

   **Mock Patterns:**

   - Mock Express request/response directly in `beforeEach` (not using factories)
   - Mock `reconcileTokenUsageFromCallback`, `recordTasksApiSuccess`, `recordTasksApiFailure`, `recordAiErrorMetrics` using `vi.mock()`
   - Use `Mocked<T>` for service dependencies
   - Use `ReturnType<typeof vi.fn>` for `NextFunction`
   - Verify `res.sendStatus()` called with `StatusCodes.OK`
   - Use `it.each()` for multiple error scenarios

#### Existing Test Files to Update

1. **`controllers/tasks-controller/tasks-controller.unit.test.ts`** (Unit test)

   **Test Structure:**

   - Follow existing test structure patterns
   - Use `Mocked<T>` for service dependencies
   - Use `ReturnType<typeof vi.fn>` for Express `NextFunction`
   - Use `vi.clearAllMocks()` in `afterEach` (mocks are used)
   - Use nested `describe` blocks for `createTask` and `getTasks`

   **createTask**: Add/update tests for:

   - ✅ Captures startTime using `getStartTimestamp`
   - ✅ Stores metadata in Redis after successful handler call (only if tokenUsage exists)
   - ✅ Doesn't store metadata if tokenUsage not available
   - ✅ Records failure metrics for immediate errors (before 202)
   - ✅ Doesn't store metadata if handler throws (before 202)
   - ✅ Mock `storeRequestMetadata` and verify call with correct parameters
   - ✅ Mock `getStartTimestamp` and verify it's called

   **getTasks**: Update to use `withMetrics`:

   - ✅ Mock `withMetrics` and verify it's called with correct parameters
   - ✅ Verify success metrics recorded via recorder.recordSuccess
   - ✅ Verify failure metrics recorded via recorder.recordFailure on error
   - ✅ Verify `withMetrics` passes startTime to handler function
   - ✅ Remove any direct metrics recording (now handled by `withMetrics`)

   **Mock Patterns:**

   - Mock `storeRequestMetadata`, `getStartTimestamp`, `withMetrics` using `vi.mock()`
   - Use `Mocked<T>` for all service dependencies
   - Verify mocks called with correct parameters using `.toHaveBeenCalledWith()`

2. **`controllers/tasks-controller/tasks-controller.integration.test.ts`** (Integration test)

   **Test Structure:**

   - Use `beforeAll` for setup (database connections, external services)
   - Use `afterEach` for cleanup (delete test data)
   - Use `afterAll` for teardown (disconnect services)
   - Use `supertest` (`request(app)`) for HTTP endpoint testing
   - Mock middleware and external services at module level
   - Validate required environment variables with clear error messages

   **Test Cases:**

   - ✅ Remove any expectations for metrics middleware (if any)
   - ✅ Verify no automatic metrics recording on res.finish
   - ✅ All metrics should be manual (verify via mocks/spies)
   - ✅ Verify `storeRequestMetadata` is called after successful AI service call

   **Mock Patterns:**

   - Mock external services (AI service, Redis) at module level using `vi.mock()`
   - Use `supertest` for HTTP endpoint testing
   - Verify metrics recorded manually (not via middleware)

3. **`controllers/capabilities-controller/capabilities-controller.unit.test.ts`** (Unit test)

   **Test Structure:**

   - Follow existing test structure patterns
   - Use `Mocked<T>` for service dependencies
   - Use `ReturnType<typeof vi.fn>` for Express `NextFunction`
   - Use `vi.clearAllMocks()` in `afterEach` (mocks are used)

   **Test Cases:**

   - ✅ Add test for startTime in queue message:
     - Verifies `getStartTimestamp` is called
     - Verifies startTime included in queue message payload
     - Verifies queue message schema includes startTime
   - ✅ Add test for failure metrics:
     - Verifies `recordAiApiFailure` called on RabbitMQ send failure
     - Verifies correct capability name and requestId passed

   **Mock Patterns:**

   - Mock `getStartTimestamp` and `recordAiApiFailure` using `vi.mock()`
   - Use `Mocked<T>` for service dependencies
   - Verify `getStartTimestamp` called and result included in queue message
   - Verify `recordAiApiFailure` called with correct parameters on error

4. **`workers/capabilities-worker/capabilities-worker.test.ts`** (Unit test)

   **Test Structure:**

   - Follow existing test structure patterns
   - Use `Mocked<T>` for service dependencies
   - Use `vi.clearAllMocks()` in `afterEach` (mocks are used)
   - Use nested `describe` blocks for metrics recording and startTime handling

   **Test Cases:**

   - ✅ Add tests for metrics recording:
     - Records success metrics AFTER capability execution, BEFORE callback
     - Records failure metrics BEFORE error callback
     - Verifies metrics recorded with correct duration from startTime
     - Records metrics without duration (0) if startTime missing/invalid
     - Verifies order: execute → record metrics → send callback
   - ✅ Add tests for startTime handling:
     - Extracts startTime from queue message
     - Validates startTime (logs warning if invalid/missing)
     - Handles missing startTime gracefully (records metrics with 0 duration)
   - ✅ Update existing tests to include startTime in mock messages

   **Mock Patterns:**

   - Mock `recordAiApiSuccess`, `recordAiApiFailure`, and `getElapsedDuration` using `vi.mock()`
   - Use `Mocked<T>` for service dependencies
   - Update existing mock message creation to include `startTime` field
   - Verify metrics called in correct order using `.toHaveBeenCalledTimes()` and call order
   - Use `it.each()` for multiple startTime scenarios (valid, invalid, missing)

5. **`middlewares/tasks-error-handler/tasks-error-handler.test.ts`** (Unit test)

   **Test Structure:**

   - Follow existing test structure patterns
   - Use `Mocked<T>` for service dependencies
   - Use `ReturnType<typeof vi.fn>` for Express `NextFunction`
   - Use `vi.clearAllMocks()` in `afterEach` (mocks are used)
   - Use nested `describe` blocks for different error types

   **Test Cases:**

   - ✅ Update to use `handleAiError()` service:
     - Mock `handleAiError` and verify it's called with error info
     - Verify it returns handler result or null
   - ✅ Update to use `recordAiErrorMetrics()` service:
     - Mock `recordAiErrorMetrics` and verify it's called independently
     - Verify it's called with error type, requestId, and operation
   - ✅ Keep existing tests for error handling logic
   - ✅ Verify metrics and error handling are decoupled (can be tested independently)

   **Mock Patterns:**

   - Mock `handleAiError` and `recordAiErrorMetrics` using `vi.mock()`
   - Use `Mocked<T>` for service dependencies
   - Verify `handleAiError` called with `extractErrorInfo` result
   - Verify `recordAiErrorMetrics` called independently (not coupled with error handling)
   - Use `it.each()` for multiple error types

6. **`middlewares/token-usage-error-handler/token-usage-error-handler.test.ts`** (Unit test)

   **Test Structure:**

   - No changes needed to test structure (handles immediate errors, uses res.locals)
   - Existing test patterns should remain unchanged

   **Test Cases:**

   - ✅ Verify it still works correctly for immediate error path
   - ✅ Existing tests should continue to pass (no refactoring needed)

   **Mock Patterns:**

   - No changes needed to mock patterns
   - Existing mocks should continue to work

#### Test Edge Cases

**Note:** These edge cases should be covered in the relevant test files above. Use `it.each()` for multiple scenarios when appropriate.

- [ ] Missing startTime in Redis metadata (should record metrics without duration)
- [ ] Missing request metadata in Redis (should log and continue, return empty object)
- [ ] Metrics recording failures (should not fail request/callback, wrapped in try-catch)
- [ ] Missing token reservation in Redis (should log and continue)
- [ ] Webhook callback processing errors (should record failure metric in catch block)
- [ ] Invalid startTime in queue message (should record metrics without duration, log warning)
- [ ] Token reconciliation failures (should still return startTime if available)
- [ ] Redis connection failures (should handle gracefully, log errors)
- [ ] Lock acquisition failures in token reconciliation (should propagate error)
- [ ] Metrics service throws error (should not break operation flow)

**Testing Patterns for Edge Cases:**

- Use `it.each()` for multiple similar scenarios
- Use `vi.spyOn()` or mock implementations to simulate failures
- Verify error handling doesn't break operation flow
- Verify logging occurs for edge cases

### 3. Token Usage Service (`services/token-usage-service/`)

Independent token reconciliation. **Critical distinction**: Two different reconciliation paths based on when the error occurs.

#### Token Usage Reconciliation Paths

**Path 1: Immediate Errors (Synchronous) - No Redis Needed**

For errors that occur **before** the AI service accepts the request (e.g., prompt injection detected in middleware):

- Error happens synchronously during request
- `res.locals.tokenUsage` is still available
- Use existing `tokenUsageErrorHandler` middleware
- Release full reservation immediately (`actualTokens = 0`)
- No Redis storage required

**Applicable Errors:**

- `PROMPT_INJECTION_DETECTED` - Detected before queueing, no tokens used
- `RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED` - Failed to enqueue, no tokens used

**Path 2: Async Errors (Asynchronous) - Redis Required**

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

**Files:**

- `token-usage-service/store-request-metadata.ts` - Store request metadata (tokens + startTime) in Redis
- `token-usage-service/get-request-metadata.ts` - Retrieve request metadata from Redis (optional helper, not needed for AI service)
- `token-usage-service/reconcile-token-usage-from-callback.ts` - Retrieve metadata and reconcile tokens from Redis

**Implementation Location:** Service layer (`services/token-usage-service/`), not in controller or handler.

**Locking Strategy:**

- **Storage**: No lock needed (simple SET with unique key, idempotent)
- **Reconciliation**: Use `with-lock` (modifies token bucket atomically)

**Example Implementation:**

```typescript
// token-usage-service/store-request-metadata.ts
import { redis } from "@clients/redis";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("storeRequestMetadata");

export type RequestMetadata = {
  userId: number;
  tokensReserved: number;
  windowStartTimestamp: number;
  startTime: number; // ✅ Include startTime for metrics
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

// token-usage-service/get-request-metadata.ts
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

// token-usage-service/reconcile-token-usage-from-callback.ts
import { redis } from "@clients/redis";
import { redlock } from "@clients/redlock";
import { createLogger } from "@shared/config/create-logger";
import { getTokenBucketLockKey } from "@shared/utils/token-bucket/key-utils";
import { updateTokenUsage as updateTokenUsageUtil } from "@shared/utils/token-bucket/update-token-usage";
import { withLock } from "@shared/utils/with-lock";
import type { RequestMetadata } from "./store-request-metadata";

const logger = createLogger("reconcileTokenUsageFromCallback");

export type ReconcileResult = {
  startTime?: number; // ✅ Return startTime for metrics
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

**Controller Usage:**

```typescript
// controllers/tasks-controller.ts
import { getStartTimestamp } from "@shared/utils/performance";
import { storeRequestMetadata } from "@services/token-usage-service";
import { recordTasksApiFailure } from "@metrics/tasks-metrics";
import { TASKS_OPERATION } from "@constants";

export const createTask = async (req, res, next) => {
  const { requestId } = res.locals;
  const { naturalLanguage } = req.body;
  const startTime = getStartTimestamp(); // ✅ Capture start time

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

    // ✅ Don't record metrics here - will be recorded in webhook callback
  } catch (error) {
    // ❌ Prompt injection comes here - BEFORE 202
    // ❌ Never reaches storeRequestMetadata
    // ✅ res.locals.tokenUsage still available
    // ✅ tokenUsageErrorHandler will release it
    // ✅ Record failure for immediate errors
    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, requestId);
    next(error);
  }
};
```

### 4. Updated Middleware (`middlewares/tasks-error-handler/`)

Compose the services for request path errors.

**Changes:**

- Use `handleAiError()` for error type routing
- Call `recordAiErrorMetrics()` independently
- Token reconciliation for immediate errors handled by `tokenUsageErrorHandler` middleware
- Logging via logger (already decoupled)

**Middleware Order:**

1. `tokenUsageRateLimiter` - Reserves tokens, stores in `res.locals`
2. Controller - Calls AI service
3. `tasksErrorHandler` - Handles AI error types, records metrics
4. `tokenUsageErrorHandler` - Releases tokens for immediate errors
5. Global error handler - Final error formatting

**Example:**

```typescript
import { NextFunction, Request, Response } from "express";

import { TASKS_OPERATION } from "@constants";
import { extractErrorInfo } from "@shared/utils/extract-error-info";
import { BadRequestError } from "@shared/errors";
import { createLogger } from "@shared/config/create-logger";
import { handleAiError } from "@services/error-handlers";
import { recordAiErrorMetrics } from "@services/metrics-service";

const logger = createLogger("tasksErrorHandler");

export const tasksErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errorInfo = extractErrorInfo(err);
  const { requestId } = res.locals;

  // Logging (always happens)
  logger.error("Handling AI error", err, { requestId, errorInfo });

  // Error handling (only for request path errors)
  const handlerResult = handleAiError(errorInfo);
  if (handlerResult) {
    // Metrics (independent)
    recordAiErrorMetrics(
      errorInfo.context?.type,
      requestId,
      TASKS_OPERATION.CREATE_TASK
    );

    // Token usage: Immediate errors handled by tokenUsageErrorHandler middleware

    // User response
    next(
      new BadRequestError(handlerResult.userMessage, {
        suggestions: handlerResult.suggestions,
      })
    );
    return;
  }

  next(err);
};
```

### 5. Updated Webhook Controller (`controllers/webhooks-controller/`)

Handle callback errors independently. Compose services as needed.

**Changes:**

- Handle `success: false` callbacks with error info
- Use `handleAiError()` for error type routing
- Call `recordAiErrorMetrics()` and `reconcileTokenUsageFromCallback()` independently
- Handle success path: reconcile tokens and record metrics
- Validate `requestId` from callback URL (startTime retrieved from Redis)
- Wrap all metrics and token reconciliation in try-catch to prevent failures

**Note:** See complete implementation example in "Usage - Async Operations (POST)" section above (lines 310-427).

## Error Type Context Mapping

| Error Type                              | Context       | Handler Location             | Token Reconciliation Path |
| --------------------------------------- | ------------- | ---------------------------- | ------------------------- |
| `PROMPT_INJECTION_DETECTED`             | Request Path  | Middleware only              | Immediate (res.locals)    |
| `RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED` | Request Path  | Middleware only              | Immediate (res.locals)    |
| `PARSE_TASK_VAGUE_INPUT_ERROR`          | Callback Path | Webhook Controller           | Async (Redis)             |
| `OPENAI_API_ERROR`                      | Callback Path | Webhook Controller           | Async (Redis)             |
| `RABBITMQ_CONSUME_MESSAGE_FAILED`       | AI Service    | Not handled in tasks service | N/A                       |

## Benefits

1. **Separation of Concerns**: Each concern (error handling, metrics, token usage, logging) is independent
2. **Context-Aware**: Request vs callback errors handled where they occur
3. **Composable**: Mix and match services as needed
4. **Testable**: Each service can be tested independently
5. **Maintainable**: Add new error types by adding handlers
6. **Flexible**: Token usage reconciliation can differ for request vs callback

## Key Implementation Points

- **Include `requestId` in callback URL**: `callbackUrl?requestId=${requestId}` (startTime stored in Redis)
- **Store `startTime` with token metadata**: Store in Redis when request is accepted (Tasks service only), retrieve in callback
- **AI service queue message**: Include `startTime` in queue message (internal, for worker convenience - no Redis needed)
- **TTL on Redis keys**: Set expiration (1 hour) to prevent bloat
- **Error handling**: If reservation missing, log and continue (don't fail callback)
- **Window validation**: Token usage reconciliation handles window changes automatically
- **Metrics failures**: Wrap all metrics calls in try-catch, log errors, don't fail operations
- **Missing startTime**: If startTime missing from Redis, record metrics without duration (0 for success, no duration for failure)
- **Missing callbacks**: Redis TTL handles cleanup, but token reservations remain (monitor for missing callbacks)
- **RequestId validation**: Validate requestId in webhook controller before processing
- **Metrics recording order (AI service)**: Record metrics AFTER capability execution, BEFORE callback delivery - measures AI service performance, not callback delivery
- **Message ack/nack**: Handled by `sendCallbackHandler` - acks on successful callback, nacks on failure (no retry)

## Open Questions / Considerations

1. **User Notification for Callback Errors**:

   - Webhook errors don't have HTTP response to user
   - Options: Store in DB, send notification, webhook to user's system
   - Need to define strategy

2. **Monitoring Missing Callbacks**:
   - Redis TTL (1 hour) automatically cleans up token reservations
   - Token usage remains reserved (counts against user's limit)
   - Consider adding monitoring/alerting for missing callbacks
   - May want to add dead letter queue handling in future

## Implementation Order

1. **Remove metrics middleware:**

   - Remove `tasksMetricsMiddleware` from tasks router
   - Remove `aiMetricsMiddleware` from AI router (if exists)
   - Delete metrics middleware directories
   - Update/remove related tests

2. **Create metrics utilities:**

   - Create `withMetrics` helper for sync operations
   - Create `recordAiErrorMetrics` service
   - Add unit tests for `withMetrics`

3. **Update sync operations (GET):**

   - Replace middleware with `withMetrics` in GET controllers
   - Add integration tests

4. **Update async operations (POST):**

   - Add `startTime` capture in controllers
   - Update `storeRequestMetadata` to include `startTime` with token metadata
   - Update `reconcileTokenUsageFromCallback` to return `startTime` from Redis
   - Update callback URL to only include `requestId` (remove `startTime`) - Tasks service
   - Add `startTime` to queue message schema - AI service (internal, acceptable)
   - Update Tasks webhook to retrieve `startTime` from Redis via token reconciliation
   - Update AI worker to get `startTime` directly from queue message
   - Record metrics manually in callbacks/workers:
     - **AI worker**: Record metrics AFTER capability execution, BEFORE callback delivery
     - **Tasks webhook**: Record metrics AFTER token reconciliation (to get startTime)
   - Handle missing `startTime` gracefully (record without duration)
   - Add integration tests

5. **Create error handler services** (pure functions)

6. **Create token usage service:**

   - `storeRequestMetadata()` - Store request metadata (tokens + startTime) in Redis (no lock needed)
   - `reconcileTokenUsageFromCallback()` - Retrieve metadata and reconcile tokens (uses `with-lock`, returns startTime)

7. **Refactor middleware:**

   - Use services (keep `tokenUsageErrorHandler` for immediate errors)

8. **Update webhook controller:**

   - Use `reconcileTokenUsageFromCallback()` for success/error callbacks
   - Record metrics for actual completion

9. **Add comprehensive tests:**
   - Create new test files (see "Test Specifications" section above - 6 new files)
   - Update existing test files (see "Test Specifications" section above - 6 files to update)
   - Unit tests for each service
   - Integration tests for full flow (sync + async)
   - Test metrics accuracy and timing
   - Test edge cases (missing startTime, Redis failures, etc.)
   - Verify all test files follow existing patterns and conventions

## Notes

- Architecture supports future extensibility (other webhook endpoints, error types)
- Services are independent and testable
- Easy to add new error types by adding handlers
