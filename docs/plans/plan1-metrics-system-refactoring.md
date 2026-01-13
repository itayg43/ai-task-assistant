# Plan 1: Metrics System Refactoring

## Overview

**Focus**: Remove metrics middleware and implement manual metrics recording for all operations (sync and async).

**Dependencies**: None (can be executed first)

**Problem**: Metrics middleware records on `res.finish`, which doesn't work for async operations:
- Sync operations (GET): Complete immediately → middleware works
- Async operations (POST → 202): Response finishes immediately, but operation completes later → middleware records false "success"

**Solution**: Fully manual metrics recording
- **Sync operations**: Use `withMetrics` helper function
- **Async operations**: Manual recording in callback/worker with `startTime` passed through

## Implementation Steps

### 1. Remove Metrics Middleware

**Tasks:**
- [ ] Remove `tasksMetricsMiddleware` from `backend/services/tasks/src/routers/index.ts`
- [ ] Remove `aiMetricsMiddleware` from `backend/services/ai/src/routers/index.ts` (if exists)
- [ ] Delete `backend/services/tasks/src/middlewares/metrics-middleware/` directory
- [ ] Delete `backend/services/ai/src/middlewares/metrics-middleware/` directory (if exists)
- [ ] Remove `createMetricsMiddleware` usage from shared code (if only used by these services)
- [ ] Update tests that rely on metrics middleware

### 2. Create Metrics Utilities

#### 2.1 Create `withMetrics` Helper

**File**: `backend/shared/src/utils/with-metrics/with-metrics.ts`

```typescript
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
```

#### 2.2 Create Error Metrics Service

**File**: `backend/services/tasks/src/services/metrics-service/record-error-metrics.ts`

```typescript
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

**File**: `backend/services/tasks/src/services/metrics-service/index.ts`

```typescript
export { recordAiErrorMetrics } from "./record-error-metrics";
```

### 3. Update Sync Operations (GET)

**File**: `backend/services/tasks/src/controllers/tasks-controller.ts`

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

### 4. Update Async Operations (POST)

#### 4.1 Tasks Service - Capture startTime

**File**: `backend/services/tasks/src/controllers/tasks-controller.ts`

```typescript
// controllers/tasks-controller.ts - POST (async)
import { StatusCodes } from "http-status-codes";
import { Request, Response, NextFunction } from "express";

import { TASKS_OPERATION } from "@constants";
import { getStartTimestamp } from "@shared/utils/performance";
import { recordTasksApiFailure } from "@metrics/tasks-metrics";
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

    res.status(StatusCodes.ACCEPTED).json({
      message,
      tasksServiceRequestId: requestId,
    });

    // ✅ Don't record metrics here - will be recorded in webhook callback
    // Note: startTime will be stored in Redis in Plan 2
  } catch (error) {
    // ✅ Record failure for immediate errors (prompt injection, etc.)
    recordTasksApiFailure(TASKS_OPERATION.CREATE_TASK, requestId);
    next(error);
  }
};
```

#### 4.2 AI Service - Capture startTime and Include in Queue Message

**File**: `backend/services/ai/src/controllers/capabilities-controller.ts`

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
```

#### 4.3 Update Queue Message Schema

**File**: `backend/services/ai/src/schemas/capabilities-queue-message.ts`

```typescript
import { z } from "zod";

export const capabilitiesQueueMessageDataSchema = z.object({
  requestId: z.string(),
  capability: z.string(),
  input: z.unknown(),
  callbackUrl: z.string(),
  startTime: z.number(), // ✅ Include startTime in queue message (internal, for worker metrics)
});
```

### 5. Update Workers to Record Metrics

#### 5.1 AI Service Worker

**File**: `backend/services/ai/src/workers/capabilities-worker.ts`

```typescript
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

**Important**: Metrics are recorded **BEFORE** callback delivery to measure AI service performance independently of callback delivery.

#### 5.2 Tasks Service Webhook (Partial - Metrics Only)

**File**: `backend/services/tasks/src/controllers/webhooks-controller.ts`

**Note**: This is a partial implementation for Plan 1. Full implementation with token reconciliation will be in Plan 2.

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
import { getAuthenticationContext } from "@shared/middlewares/authentication";
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

      // Note: Token reconciliation and error metrics will be added in Plans 2 & 3
      return;
    }

    // Success path
    const { result } = req.body;
    await createTaskHandler(userId, result.result);

    // ✅ Record actual success with total duration
    // Note: startTime will be retrieved from Redis in Plan 2
    // For now, record without duration (will be updated in Plan 2)
    try {
      recordTasksApiSuccess(TASKS_OPERATION.CREATE_TASK, 0, requestId);
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

## Test Specifications

### New Test Files to Create

#### 1. `shared/utils/with-metrics/with-metrics.test.ts` (Unit test)

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

#### 2. `services/metrics-service/record-error-metrics.test.ts` (Unit test)

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

### Existing Test Files to Update

#### 1. `controllers/tasks-controller/tasks-controller.unit.test.ts` (Unit test)

**Test Structure:**
- Follow existing test structure patterns
- Use `Mocked<T>` for service dependencies
- Use `ReturnType<typeof vi.fn>` for Express `NextFunction`
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)
- Use nested `describe` blocks for `createTask` and `getTasks`

**createTask**: Add/update tests for:
- ✅ Captures startTime using `getStartTimestamp`
- ✅ Records failure metrics for immediate errors (before 202)
- ✅ Mock `getStartTimestamp` and verify it's called

**getTasks**: Update to use `withMetrics`:
- ✅ Mock `withMetrics` and verify it's called with correct parameters
- ✅ Verify success metrics recorded via recorder.recordSuccess
- ✅ Verify failure metrics recorded via recorder.recordFailure on error
- ✅ Verify `withMetrics` passes startTime to handler function
- ✅ Remove any direct metrics recording (now handled by `withMetrics`)

**Mock Patterns:**
- Mock `getStartTimestamp`, `withMetrics` using `vi.mock()`
- Use `Mocked<T>` for all service dependencies
- Verify mocks called with correct parameters using `.toHaveBeenCalledWith()`

#### 2. `controllers/tasks-controller/tasks-controller.integration.test.ts` (Integration test)

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

**Mock Patterns:**
- Mock external services (AI service, Redis) at module level using `vi.mock()`
- Use `supertest` for HTTP endpoint testing
- Verify metrics recorded manually (not via middleware)

#### 3. `controllers/capabilities-controller/capabilities-controller.unit.test.ts` (Unit test)

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

#### 4. `workers/capabilities-worker/capabilities-worker.test.ts` (Unit test)

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

## Key Implementation Points

- **Remove all metrics middleware**: No automatic metrics recording on `res.finish`
- **Sync operations use `withMetrics`**: Wraps handler function, records success/failure automatically
- **Async operations capture `startTime`**: Store in queue message (AI service) or Redis (Tasks service - Plan 2)
- **Metrics recorded at completion**: 
  - AI worker: After capability execution, before callback
  - Tasks webhook: After processing (startTime from Redis in Plan 2)
- **Handle missing `startTime` gracefully**: Record metrics without duration (0 for success)
- **Metrics failures don't break flow**: Wrap all metrics calls in try-catch, log errors
- **Queue message schema**: Include `startTime` field (AI service only, internal use)

## Success Criteria

- [ ] All metrics middleware removed
- [ ] `withMetrics` helper created and tested
- [ ] `recordAiErrorMetrics` service created and tested
- [ ] Sync operations (GET) use `withMetrics`
- [ ] Async operations (POST) capture `startTime`
- [ ] AI service worker records metrics with correct timing
- [ ] Tasks service webhook records metrics (partial - full implementation in Plan 2)
- [ ] All tests pass
- [ ] No automatic metrics recording on `res.finish`
