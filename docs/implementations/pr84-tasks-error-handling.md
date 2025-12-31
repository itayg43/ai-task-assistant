# Tasks Error Handling Implementation

## Overview

This document summarizes the implementation of **Tasks Service Error Handling Middleware**. This feature adds domain-specific error handling for the Tasks service, including error metrics tracking, token usage reconciliation on errors, and proper error sanitization to prevent information leakage. The implementation follows project conventions for router-level error handlers and maintains separation of concerns between controllers and error handling logic.

## Architecture Alignment

This implementation follows patterns documented in `.cursor/rules/project-conventions.mdc`:
- Router-level error handlers (domain-specific error handling in routers)
- Controller patterns (no error handling in controllers, only `next(error)`)
- Two-level error handling (domain handlers + global handler)
- Error sanitization to prevent information leakage
- Metrics recording in error handlers (not controllers)

## Implementation Details

### 1. Create TASKS_OPERATION Constant

**Rationale**: Type-safe operation tracking for metrics and error handling. Ensures consistency across the codebase when referencing task operations.

**File**: `backend/services/tasks/src/constants/tasks-operation.ts`

**Implementation**:

```typescript
export const TASKS_OPERATION = {
  CREATE_TASK: "create_task",
  GET_TASKS: "get_tasks",
} as const;
```

**Type Export**: `backend/services/tasks/src/types/tasks-operation.ts`

- Exports `TasksOperation` type derived from `TASKS_OPERATION` constant
- Provides type safety for operation parameters in metrics and error handlers

**Usage**: Used in metrics recording and error handlers to ensure consistent operation naming across the service.

### 2. Add Prompt Injection Metrics Tracking

**Rationale**: Track prompt injection detection events at the Tasks service level to monitor security events and understand attack patterns.

**File**: `backend/services/tasks/src/metrics/tasks-metrics/tasks-metrics.ts`

**Implementation**:

- Added `tasksPromptInjectionTotal` counter with `operation` label
- Created `recordPromptInjection(operation, requestId)` helper function
- Includes debug logging with requestId for traceability

**Metric Details**:

- **Name**: `tasks_prompt_injection_total`
- **Type**: Counter
- **Labels**: `operation` (create_task | get_tasks)
- **Purpose**: Track number of requests blocked due to prompt injection detection

**Usage**: Called from `tasksErrorHandler` when `AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED` error is detected.

### 3. Create Tasks Error Handler Middleware

**Rationale**: Domain-specific error handling middleware that processes AI service errors, records metrics, reconciles token usage, and sanitizes errors before passing to the global error handler.

**File**: `backend/services/tasks/src/middlewares/tasks-error-handler/tasks-error-handler.ts`

**Error Types Handled**:

1. **`PARSE_TASK_VAGUE_INPUT_ERROR`**:
   - Records vague input metric via `recordVagueInput(requestId)`
   - Reconciles token usage if `tokenUsage` and `openaiMetadata` are available
   - Extracts actual token usage from OpenAI metadata
   - Sanitizes error: removes `openaiMetadata` and other internal details, keeps only user-facing `suggestions`

2. **`PROMPT_INJECTION_DETECTED`**:
   - Records prompt injection metric via `recordPromptInjection(operation, requestId)`
   - Sanitizes error: removes all context to prevent information leakage about detection mechanisms
   - Returns only generic message: "Invalid input provided."

**Error Handler Pattern**:

```typescript
export const tasksErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check if error is BaseError with context.type
  const isBaseError = err instanceof BaseError;
  const isBaseErrorWithoutTypeInContext = isBaseError && !err.context?.type;
  if (!isBaseError || isBaseErrorWithoutTypeInContext) {
    next(err); // Pass through to next error handler
    return;
  }

  const errorData = err.context as TAiErrorData;
  switch (errorData.type) {
    case AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR: {
      parseTaskVagueInputErrorHandler(req, res, next, errorData);
      break;
    }
    case AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED: {
      // Handle prompt injection
      break;
    }
    default: {
      next(err); // Pass through unhandled types
    }
  }
};
```

**Vague Input Error Handler**:

- Extracts `requestId`, `tokenUsage` from `res.locals`
- Records vague input metric
- Validates `openaiMetadata` presence and structure
- If valid: extracts actual tokens and reconciles token usage reservation
- Sanitizes error by creating new `BadRequestError` with only `message` and `suggestions`

**Token Usage Reconciliation**:

- Only reconciles if both `tokenUsage` and valid `openaiMetadata` exist
- Uses `extractOpenaiTokenUsage()` utility to get actual token count
- Sets `tokenUsage.actualTokens` to actual value
- Calls `openaiUpdateTokenUsage()` middleware to update Redis state

**Error Sanitization Strategy**:

- **Vague Input Errors**: Keep user-facing `suggestions`, remove all internal details (`openaiMetadata`, `aiServiceRequestId`, etc.)
- **Prompt Injection Errors**: Remove all context to prevent attackers from learning about detection mechanisms
- Creates new error objects to ensure no internal context leaks through

**Tests**: Comprehensive unit tests covering:

- Vague input error handling with token usage reconciliation
- Vague input error handling without token usage (missing tokenUsage or openaiMetadata)
- Error sanitization verification (new error objects, only safe context)
- Prompt injection error handling and metric recording
- Error passthrough for non-BaseError and unhandled error types
- Parameterized tests using `it.each` for similar scenarios

### 4. Create Token Usage Error Handler Middleware

**Rationale**: Ensures token usage reservations are always released on errors, even for unexpected failures that aren't handled by domain-specific error handlers. This prevents token reservations from being "stuck" when errors occur.

**File**: `backend/services/tasks/src/middlewares/token-usage-error-handler/token-usage-error-handler.ts`

**Implementation**:

- Checks if `tokenUsage` exists and `actualTokens` is undefined (not yet reconciled)
- If not reconciled: sets `actualTokens = 0` to release full reservation
- Calls `openaiUpdateTokenUsage()` to update Redis state
- Logs debug message when reconciliation is skipped (for observability)
- Always propagates error to next handler

**Error Handler Pattern**:

```typescript
export const tokenUsageErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const tokenUsage = res.locals.tokenUsage;

  // If no reservation or already reconciled, skip update
  if (!tokenUsage || tokenUsage.actualTokens !== undefined) {
    logger.debug("Token usage reconciliation skipped", {
      requestId: res.locals.requestId,
      tokenUsage,
    });
    next(err);
    return;
  }

  // Other errors: release full reservation
  tokenUsage.actualTokens = 0;
  void openaiUpdateTokenUsage(req, res, () => {});
  next(err);
};
```

**Behavior**:

- **No tokenUsage**: Skips update (no reservation was made)
- **Already reconciled**: Skips update (domain handler already handled it)
- **Not reconciled**: Releases full reservation by setting `actualTokens = 0`

**Tests**: Unit tests covering:

- Token usage release for unexpected errors
- Skip update when no reservation exists
- Skip update when already reconciled (using parameterized tests with `it.each`)
- Proper error propagation

### 5. Wire Error Handlers to Tasks Router

**Rationale**: Place error handlers in the correct middleware chain position following project conventions.

**File**: `backend/services/tasks/src/routers/tasks-router.ts`

**Middleware Chain Order**:

Following project conventions, the middleware chain follows this order:

1. **Metrics middleware** - Track all requests (at router level)
2. **Routes** - Route handlers with validation, rate limiting, etc.
3. **Domain error handlers** - Handle domain-specific errors (record metrics, sanitize errors, reconcile state)
4. **Post-response middleware** - Update state after response (e.g., token usage reconciliation)
5. **Global error handler** - Final error handler in `app.ts` (catches all unhandled errors)

**Implementation**:

```typescript
tasksRouter.use(tasksMetricsMiddleware);

tasksRouter.post("/", [validateSchema(createTaskSchema), openaiTokenUsageRateLimiter.createTask], createTask, openaiUpdateTokenUsage);
tasksRouter.get("/", [validateSchema(getTasksSchema)], getTasks);

// Domain-specific error handlers (after routes, before global error handler)
// Order matters: tasksErrorHandler must run before tokenUsageErrorHandler
// because tasksErrorHandler handles specific error types and may reconcile
// token usage, while tokenUsageErrorHandler handles ALL remaining errors
// and releases full reservation for unexpected failures
tasksRouter.use(tasksErrorHandler);

// Reconcile token usage reservations on any failure (before global error handler)
// This handler runs after tasksErrorHandler to catch any errors that weren't
// already handled, ensuring token reservations are always released
tasksRouter.use(tokenUsageErrorHandler);
```

**Order Dependency**:

- `tasksErrorHandler` must run before `tokenUsageErrorHandler`
- `tasksErrorHandler` handles specific error types and may reconcile token usage
- `tokenUsageErrorHandler` handles ALL remaining errors and releases full reservation
- This ensures domain-specific errors are handled first, and unexpected errors still release reservations

### 6. Update Controller to Delegate Errors

**Rationale**: Controllers should not handle errors directly. They should only call `next(error)` to pass errors to error handler middleware.

**File**: `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`

**Pattern**:

```typescript
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // ... business logic ...
    res.status(StatusCodes.CREATED).json(response);
    next(); // Continue to post-response middleware
  } catch (error) {
    next(error); // Pass to error handler middleware
  }
};
```

**Key Points**:

- Controllers never handle errors directly
- All errors are passed to error handler middleware via `next(error)`
- Success responses call `next()` to continue to post-response middleware
- Error handlers are responsible for metrics, sanitization, and state reconciliation

## Error Flow

### Success Flow

1. Request → Metrics Middleware → Routes → Controller
2. Controller processes request successfully
3. Controller sends response and calls `next()` for post-response middleware
4. Post-response middleware (e.g., `openaiUpdateTokenUsage`) reconciles token usage
5. Request completes

### Error Flow - Domain Error (Vague Input)

1. Request → Metrics Middleware → Routes → Controller
2. Controller calls AI service, receives `PARSE_TASK_VAGUE_INPUT_ERROR`
3. Controller calls `next(error)` to pass error to error handlers
4. `tasksErrorHandler`:
   - Records vague input metric
   - Reconciles token usage (if metadata available)
   - Sanitizes error (removes internal details, keeps suggestions)
   - Calls `next(sanitizedError)`
5. `tokenUsageErrorHandler`: Skips (already reconciled)
6. Global error handler: Formats and sends error response

### Error Flow - Domain Error (Prompt Injection)

1. Request → Metrics Middleware → Routes → Controller
2. Controller calls AI service, receives `PROMPT_INJECTION_DETECTED`
3. Controller calls `next(error)` to pass error to error handlers
4. `tasksErrorHandler`:
   - Records prompt injection metric
   - Sanitizes error (removes all context)
   - Calls `next(sanitizedError)`
5. `tokenUsageErrorHandler`: Skips (no tokenUsage for prompt injection - blocked before AI call)
6. Global error handler: Formats and sends error response

### Error Flow - Unexpected Error

1. Request → Metrics Middleware → Routes → Controller
2. Controller encounters unexpected error (e.g., database error)
3. Controller calls `next(error)` to pass error to error handlers
4. `tasksErrorHandler`: Passes through (not a domain error)
5. `tokenUsageErrorHandler`:
   - Releases full token reservation (`actualTokens = 0`)
   - Updates Redis state
   - Calls `next(error)`
6. Global error handler: Formats and sends error response

## Security Considerations

### Error Sanitization

**Vague Input Errors**:
- Removes: `openaiMetadata`, `aiServiceRequestId`, internal error details
- Keeps: `message`, `suggestions` (user-facing guidance)

**Prompt Injection Errors**:
- Removes: All context (type, aiServiceRequestId, detection details)
- Keeps: Only generic message ("Invalid input provided.")
- Rationale: Prevents attackers from learning about detection mechanisms

### Information Hiding

- Error responses never expose internal implementation details
- OpenAI metadata is never sent to clients
- Error types are sanitized before client responses
- Full error context is logged server-side for debugging

## Testing

### Unit Tests

**Tasks Error Handler** (`tasks-error-handler.test.ts`):
- Uses base mock data pattern from `@mocks/tasks-mocks`
- Parameterized tests with `it.each` for similar scenarios
- Tests error sanitization (verifies new error objects)
- Tests token usage reconciliation conditions
- Tests error passthrough for unhandled types

**Token Usage Error Handler** (`token-usage-error-handler.test.ts`):
- Parameterized tests with `it.each` for skip conditions
- Tests token usage release for unexpected errors
- Tests proper error propagation

### Test Patterns

- **Base Mock Data**: Reuses mocks from `@mocks/tasks-mocks` files
- **Parameterized Tests**: Uses `it.each` for similar test scenarios
- **Type Safety**: Uses proper TypeScript types for error data
- **Explicit Setup**: Uses `setResLocals` functions for test data setup

## Metrics Impact

### New Metrics

- **`tasks_prompt_injection_total`**: Tracks prompt injection detection events
  - Labeled by `operation` for filtering by operation type
  - Used for security monitoring and attack pattern analysis

### Existing Metrics

- **`tasks_vague_input_total`**: Now recorded in error handler (moved from controller)
  - Maintains separation of concerns
  - Consistent with other domain metrics

## Dependencies

- `@shared/errors`: BaseError, BadRequestError for error handling
- `@shared/middlewares/token-usage-rate-limiter`: Token usage reconciliation
- `@metrics/tasks-metrics`: Metrics recording functions
- `@utils/extract-openai-token-usage`: Token extraction utility
- `@constants`: AI_ERROR_TYPE, TASKS_OPERATION constants

## Related PRs

- **PR #82**: Tasks Service Metrics (introduced `recordVagueInput`)
- **PR #70**: Prompt Injection Mitigation (introduced `PROMPT_INJECTION_DETECTED` error type)
- **PR #65**: Token Usage Rate Limiter (introduced token usage reconciliation infrastructure)

