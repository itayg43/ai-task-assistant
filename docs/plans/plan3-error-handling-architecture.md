# Plan 3: Error Handling Architecture

## Overview

**Focus**: Implement composable error handling architecture with separation of concerns.

**Dependencies**: 
- Plan 1 (needs `recordAiErrorMetrics` service)
- Plan 2 (needs token reconciliation in webhook)

**Problem**: After transitioning to async operations, errors occur in two distinct contexts:
1. **Request Path (Synchronous)**: Errors that occur when calling the AI service
   - `PROMPT_INJECTION_DETECTED` - Detected in AI service middleware before queueing
   - `RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED` - When enqueueing fails
   - These errors never reach callbacks

2. **Callback Path (Asynchronous)**: Errors that occur during capability execution
   - `PARSE_TASK_VAGUE_INPUT_ERROR` - Detected in AI worker after OpenAI responds
   - `OPENAI_API_ERROR` - OpenAI API failures during capability execution
   - Other capability execution errors

The current `tasksErrorHandler` middleware only covers the request path. Callback errors need separate handling.

**Solution**: Create composable error handling architecture:
- **Error Type Handlers**: Pure functions that map error types to user-facing responses
- **Separation of Concerns**: Error handling, metrics, token usage, and logging are independent
- **Context-Aware**: Request vs callback errors handled where they occur

## Design Principles

- **Separation of Concerns**: Error handling, metrics, token usage, and logging are independent modules
- **Context-Aware**: Request vs callback errors handled where they occur
- **Composable**: Services can be mixed and matched as needed
- **Testable**: Each service can be tested independently

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Error Type Handlers                        │
│  (Pure functions - no side effects)                     │
│  - handleVagueInputError(errorInfo)                    │
│  - handlePromptInjectionError(errorInfo)               │
│  - handleRabbitMQError(errorInfo)                       │
│  - handleOpenAIError(errorInfo)                         │
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

## Implementation Steps

### 1. Create Error Type Handlers

#### 1.1 Vague Input Error Handler

**File**: `backend/services/tasks/src/services/error-handlers/vague-input-error-handler.ts`

```typescript
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
```

#### 1.2 Prompt Injection Error Handler

**File**: `backend/services/tasks/src/services/error-handlers/prompt-injection-error-handler.ts`

```typescript
import { StatusCodes } from "http-status-codes";

import { ExtractedErrorInfo } from "@shared/types";

export const handlePromptInjectionError = (
  errorInfo: ExtractedErrorInfo
): ErrorHandlerResult => {
  return {
    userMessage: "Your request contains potentially harmful content and cannot be processed.",
    httpStatus: StatusCodes.BAD_REQUEST,
  };
};
```

#### 1.3 RabbitMQ Error Handler

**File**: `backend/services/tasks/src/services/error-handlers/rabbitmq-error-handler.ts`

```typescript
import { StatusCodes } from "http-status-codes";

import { ExtractedErrorInfo } from "@shared/types";

export const handleRabbitMQError = (
  errorInfo: ExtractedErrorInfo
): ErrorHandlerResult => {
  return {
    userMessage: "The service is temporarily unavailable. Please try again later.",
    httpStatus: StatusCodes.SERVICE_UNAVAILABLE,
  };
};
```

#### 1.4 OpenAI Error Handler

**File**: `backend/services/tasks/src/services/error-handlers/openai-error-handler.ts`

```typescript
import { StatusCodes } from "http-status-codes";

import { ExtractedErrorInfo } from "@shared/types";

export const handleOpenAIError = (
  errorInfo: ExtractedErrorInfo
): ErrorHandlerResult => {
  return {
    userMessage: "An error occurred while processing your request. Please try again later.",
    httpStatus: StatusCodes.INTERNAL_SERVER_ERROR,
  };
};
```

#### 1.5 Error Handler Router

**File**: `backend/services/tasks/src/services/error-handlers/index.ts`

```typescript
import { AI_ERROR_TYPE } from "@constants";
import { ExtractedErrorInfo } from "@shared/types";
import { handleVagueInputError } from "./vague-input-error-handler";
import { handlePromptInjectionError } from "./prompt-injection-error-handler";
import { handleRabbitMQError } from "./rabbitmq-error-handler";
import { handleOpenAIError } from "./openai-error-handler";
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
    case AI_ERROR_TYPE.RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED:
      return handleRabbitMQError(errorInfo);
    case AI_ERROR_TYPE.OPENAI_API_ERROR:
      return handleOpenAIError(errorInfo);
    default:
      return null;
  }
};

export type { ErrorHandlerResult } from "./vague-input-error-handler";
```

### 2. Update Tasks Error Handler Middleware

**File**: `backend/services/tasks/src/middlewares/tasks-error-handler/tasks-error-handler.ts`

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
    // Metrics (independent) - from Plan 1
    recordAiErrorMetrics(
      errorInfo.context?.type,
      requestId,
      TASKS_OPERATION.CREATE_TASK
    );

    // Token usage: Immediate errors handled by tokenUsageErrorHandler middleware
    // (existing middleware, no changes needed)

    // User response
    next(
      new BadRequestError(handlerResult.userMessage, {
        suggestions: handlerResult.suggestions,
        statusCode: handlerResult.httpStatus,
      })
    );
    return;
  }

  next(err);
};
```

**Middleware Order:**
1. `tokenUsageRateLimiter` - Reserves tokens, stores in `res.locals`
2. Controller - Calls AI service
3. `tasksErrorHandler` - Handles AI error types, records metrics
4. `tokenUsageErrorHandler` - Releases tokens for immediate errors (existing, no changes)
5. Global error handler - Final error formatting

### 3. Update Tasks Webhook Controller

**File**: `backend/services/tasks/src/controllers/webhooks-controller.ts`

**Note**: This builds on the webhook controller from Plans 1 & 2, adding error handling.

```typescript
// controllers/webhooks-controller.ts - Handle callback errors
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
import { handleAiError } from "@services/error-handlers";
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

      // ✅ Record error-specific metrics - from Plan 1
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

      // ✅ Token usage reconciliation - from Plan 2
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

      // ✅ Error handling (for callback errors)
      // Note: User notification strategy TBD (see "Open Questions" section)
      const handlerResult = handleAiError(error);
      if (handlerResult) {
        logger.info("Handled callback error", {
          requestId,
          errorType: error.context?.type,
          userMessage: handlerResult.userMessage,
        });
        // TODO: Store error in DB, send notification, or webhook to user's system
      }

      return;
    }

    // Success path - from Plans 1 & 2
    const { result } = req.body;
    await createTaskHandler(userId, result.result);

    // ✅ Token usage reconciliation (returns startTime from Redis) - from Plan 2
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

## Error Type Context Mapping

| Error Type                              | Context       | Handler Location             | Token Reconciliation Path |
| --------------------------------------- | ------------- | ---------------------------- | ------------------------- |
| `PROMPT_INJECTION_DETECTED`             | Request Path  | Middleware only              | Immediate (res.locals)    |
| `RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED` | Request Path  | Middleware only              | Immediate (res.locals)    |
| `PARSE_TASK_VAGUE_INPUT_ERROR`          | Callback Path | Webhook Controller           | Async (Redis)             |
| `OPENAI_API_ERROR`                      | Callback Path | Webhook Controller           | Async (Redis)             |
| `RABBITMQ_CONSUME_MESSAGE_FAILED`       | AI Service    | Not handled in tasks service | N/A                       |

## Test Specifications

### New Test Files to Create

#### 1. `services/error-handlers/vague-input-error-handler.test.ts` (Unit test)

**Test Structure:**
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)

**Test Cases:**
- ✅ Returns correct user message from error data
- ✅ Returns suggestions from error data
- ✅ Returns BAD_REQUEST status code
- ✅ Handles missing suggestions gracefully

**Mock Patterns:**
- Create mock `ExtractedErrorInfo` with `TAiParseTaskVagueInputErrorData` context
- Verify return value matches expected structure

#### 2. `services/error-handlers/prompt-injection-error-handler.test.ts` (Unit test)

**Test Structure:**
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)

**Test Cases:**
- ✅ Returns appropriate user message
- ✅ Returns BAD_REQUEST status code
- ✅ No suggestions returned

**Mock Patterns:**
- Create mock `ExtractedErrorInfo` with prompt injection context
- Verify return value matches expected structure

#### 3. `services/error-handlers/rabbitmq-error-handler.test.ts` (Unit test)

**Test Structure:**
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)

**Test Cases:**
- ✅ Returns service unavailable message
- ✅ Returns SERVICE_UNAVAILABLE status code

**Mock Patterns:**
- Create mock `ExtractedErrorInfo` with RabbitMQ error context
- Verify return value matches expected structure

#### 4. `services/error-handlers/openai-error-handler.test.ts` (Unit test)

**Test Structure:**
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)

**Test Cases:**
- ✅ Returns generic error message
- ✅ Returns INTERNAL_SERVER_ERROR status code

**Mock Patterns:**
- Create mock `ExtractedErrorInfo` with OpenAI error context
- Verify return value matches expected structure

#### 5. `services/error-handlers/index.test.ts` (Unit test)

**Test Structure:**
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
- Use `vi.clearAllMocks()` in `afterEach` (mocks are used)
- Use `it.each()` for multiple error types

**Test Cases:**
- ✅ Routes to correct handler for each error type
- ✅ Returns null for unknown error types
- ✅ Returns null when error type is missing
- ✅ Returns handler result for known error types

**Mock Patterns:**
- Mock all individual handlers using `vi.mock()`
- Use `Mocked<T>` for handler types
- Verify correct handler called for each error type
- Use `it.each()` for multiple error type scenarios

### Existing Test Files to Update

#### 1. `middlewares/tasks-error-handler/tasks-error-handler.test.ts` (Unit test)

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
- ✅ Verify correct HTTP status code passed to BadRequestError
- ✅ Verify suggestions passed to BadRequestError when available

**Mock Patterns:**
- Mock `handleAiError` and `recordAiErrorMetrics` using `vi.mock()`
- Use `Mocked<T>` for service dependencies
- Verify `handleAiError` called with `extractErrorInfo` result
- Verify `recordAiErrorMetrics` called independently (not coupled with error handling)
- Use `it.each()` for multiple error types

#### 2. `controllers/webhooks-controller/webhooks-controller.test.ts` (Unit test)

**Test Structure:**
- Follow existing test structure from Plan 2
- Use nested `describe` blocks for success/error paths

**Test Cases:**
- ✅ Error callback: records failure and error-specific metrics, reconciles tokens
- ✅ Error callback: uses `handleAiError` to process error
- ✅ Error callback: logs error handling result
- ✅ Handles error callback without openaiMetadata (uses 0 tokens)
- ✅ Handles metrics recording failures gracefully (try-catch around metrics)
- ✅ Handles token reconciliation failures gracefully (try-catch)
- ✅ Handles error handler failures gracefully (try-catch)

**Mock Patterns:**
- Mock `handleAiError` using `vi.mock()`
- Use `Mocked<T>` for service dependencies
- Verify `handleAiError` called with error from callback
- Verify error handling result logged
- Use `it.each()` for multiple error scenarios

## Key Implementation Points

- **Pure functions**: Error handlers have no side effects, only transform error info to user messages
- **Separation of concerns**: Error handling, metrics, token usage, and logging are independent
- **Context-aware**: Request vs callback errors handled where they occur
- **Composable**: Services can be mixed and matched as needed
- **Testable**: Each service can be tested independently
- **Error handler router**: Routes error types to appropriate handlers
- **Middleware integration**: Uses error handlers for request path errors
- **Webhook integration**: Uses error handlers for callback path errors
- **User notification**: Strategy TBD for callback errors (see "Open Questions")

## Open Questions / Considerations

1. **User Notification for Callback Errors**:
   - Webhook errors don't have HTTP response to user
   - Options: Store in DB, send notification, webhook to user's system
   - Need to define strategy
   - **Action**: Log error handling result for now, implement notification strategy later

2. **Error Handler Extensibility**:
   - Easy to add new error types by adding handlers
   - Update router function to include new error types
   - Follow existing handler pattern

## Success Criteria

- [ ] Error type handlers created (vague input, prompt injection, RabbitMQ, OpenAI)
- [ ] Error handler router created (`handleAiError`)
- [ ] Tasks error handler middleware updated to use error handlers
- [ ] Tasks webhook controller updated to handle callback errors
- [ ] Metrics recording decoupled from error handling
- [ ] Token reconciliation decoupled from error handling
- [ ] All tests pass
- [ ] Error handlers are pure functions (no side effects)
- [ ] Easy to add new error types
