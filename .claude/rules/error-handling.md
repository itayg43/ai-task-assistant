# Error Handling Patterns

This file documents error handling patterns and best practices for maintaining consistent, debuggable error flows.

## Custom Error Hierarchy

### Rule: Always Use Typed Errors from `@shared/errors`

**Available error types:**
- `BadRequestError` (400) - Invalid client input
- `AuthenticationError` (401) - Missing/invalid authentication
- `ForbiddenError` (403) - Authenticated but not authorized
- `NotFoundError` (404) - Resource not found
- `TooManyRequestsError` (429) - Rate limit exceeded
- `InternalError` (500) - Server-side errors
- `ServiceUnavailableError` (503) - Dependency unavailable

#### ❌ BAD - Generic Error

```typescript
if (!task) {
  throw new Error("Task not found");
}
```

**Problems:**
- No HTTP status code
- No error context
- Hard to differentiate error types
- Breaks error transformation at service boundaries

#### ✅ GOOD - Typed Error with Context

```typescript
if (!task) {
  throw new NotFoundError("Task not found", {
    taskId,
    userId,
    requestId,
  });
}
```

**Benefits:**
- Automatic HTTP status code
- Structured error context
- Type-safe error handling
- Proper logging and monitoring

---

## Error Context

### Rule: Always Include requestId and Operation Context

**Standard context fields:**
- `requestId`: Request tracking ID (required)
- `operation`: Function/method name (recommended)
- Entity IDs: `taskId`, `userId`, `accountId`, etc. (as relevant)
- Additional context: Any data that helps debug the error

#### ❌ BAD - No Context

```typescript
throw new InternalError("Database query failed");
```

#### ✅ GOOD - Rich Context

```typescript
throw new InternalError("Database query failed", {
  operation: "findTaskById",
  taskId,
  userId,
  requestId,
});
```

**Why:** Context helps with debugging, logging, and monitoring. When an error happens in production, you need to know what operation failed and for which request/user/entity.

---

## Error Transformation at Service Boundaries

### Rule: Preserve Context Between Services, Strip for Clients

**Service → Service:** Full error with internal context
**Service → Client:** Sanitized error, no internal details

#### Example: AI Service → Tasks Service

```typescript
// AI Service throws with full context
throw new BadRequestError("Vague input detected", {
  type: "VAGUE_INPUT_ERROR",
  input: naturalLanguage,
  requestId,
});

// Tasks Service receives and forwards
try {
  await aiService.parseTask(input);
} catch (error) {
  // Error context is preserved for service-to-service
  logger.error("AI service error", error, { requestId });
  throw error; // Forward to error handler
}
```

#### Example: Tasks Service → Client

```typescript
// tasks-error-handler.ts
export const tasksErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const baseError = err as BaseError;

  // Log with full context (internal)
  logger.error("Request failed", baseError, {
    requestId: res.locals.requestId,
    path: req.path,
  });

  // Strip internal context before sending to client
  res.status(baseError.statusCode || 500).json({
    error: {
      message: baseError.message,
      statusCode: baseError.statusCode,
      // NO internal context like 'type', 'operation', etc.
    },
  });
};
```

**Why:**
- Internal services need full context for debugging
- Clients should not see internal error types, operations, or sensitive data
- Logs capture everything for troubleshooting

---

## Logging Errors

### Rule: Log Errors at the Right Level with Context

**Logging levels:**
- `error`: Actual errors that need investigation
- `warn`: Unexpected but handled situations
- `info`: Normal operational events
- `debug`: Detailed diagnostic information

#### ❌ BAD - Logging Without Context

```typescript
catch (error) {
  logger.error("Operation failed");
  throw error;
}
```

#### ✅ GOOD - Structured Error Logging

```typescript
catch (error) {
  logger.error("Database query failed", error, {
    operation: "createTask",
    taskId,
    userId,
    requestId,
  });
  throw new InternalError("Failed to create task", {
    taskId,
    userId,
    requestId,
  });
}
```

**Pattern:**
1. Log error with full context
2. Throw typed error with relevant context
3. Let error handler middleware format response

---

## Controller Error Handling

### Rule: Controllers Should Not Handle Errors Directly

Controllers should catch errors only to add context, then pass to `next()`.

#### ❌ BAD - Controller Handles Error

```typescript
export const createTask = async (req: Request, res: Response) => {
  try {
    const task = await createTaskService(req.body);
    res.json({ task });
  } catch (error) {
    // DON'T DO THIS - let error handler middleware deal with it
    res.status(500).json({ error: "Internal server error" });
  }
};
```

#### ✅ GOOD - Pass to Error Handler

```typescript
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const task = await createTaskService(req.body);
    res.json({ task });
  } catch (error) {
    next(error); // Error handler middleware will format response
  }
};
```

**Exception:** When you need to add controller-specific context:

```typescript
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const task = await createTaskService(req.body);
    res.json({ task });
  } catch (error) {
    logger.error("Task creation failed in controller", error, {
      requestId: res.locals.requestId,
      userId: res.locals.userId,
    });
    next(error);
  }
};
```

---

## Service Layer Error Handling

### Rule: Throw Typed Errors with Context

Services should throw typed errors and let the error handler middleware deal with HTTP responses.

#### ✅ Example: Input Validation

```typescript
export const createTask = async (
  userId: string,
  input: CreateTaskInput
): Promise<Task> => {
  if (!input.naturalLanguage || input.naturalLanguage.trim() === "") {
    throw new BadRequestError("Natural language input is required", {
      operation: "createTask",
      userId,
    });
  }

  // ... rest of logic
};
```

#### ✅ Example: External Service Failure

```typescript
export const callOpenAI = async (prompt: string): Promise<ParsedTask> => {
  try {
    const response = await openai.chat.completions.create({ /* ... */ });
    return response.data;
  } catch (error) {
    logger.error("OpenAI API call failed", error, {
      operation: "callOpenAI",
      prompt: prompt.substring(0, 100), // Don't log full prompt
    });
    throw new ServiceUnavailableError("AI service unavailable", {
      operation: "callOpenAI",
      provider: "OpenAI",
    });
  }
};
```

#### ✅ Example: Resource Not Found

```typescript
export const findTaskById = async (
  taskId: string,
  userId: string
): Promise<Task> => {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!task) {
    throw new NotFoundError("Task not found", {
      taskId,
      userId,
      operation: "findTaskById",
    });
  }

  return task;
};
```

---

## Repository Layer Error Handling

### Rule: Let Database Errors Bubble Up with Context

Repositories should catch database errors only to add context, then rethrow as typed errors.

#### ✅ Example: Database Constraint Violation

```typescript
export const createTask = async (
  prisma: PrismaClient,
  data: CreateTaskInput
): Promise<Task> => {
  try {
    return await prisma.task.create({ data });
  } catch (error) {
    if (error.code === "P2002") {
      // Unique constraint violation
      throw new BadRequestError("Task with this title already exists", {
        operation: "createTask",
        title: data.title,
      });
    }

    // Unknown database error - rethrow as internal error
    logger.error("Database error", error, {
      operation: "createTask",
      data,
    });
    throw new InternalError("Failed to create task", {
      operation: "createTask",
    });
  }
};
```

---

## Fire-and-Forget Error Handling

### Rule: Always Log Errors in Background Operations

Even non-critical background operations should log errors.

#### ❌ BAD - Silent Failure

```typescript
void reconcileTokens(redis, requestId, tokens);
```

#### ✅ GOOD - Error Logging

```typescript
void reconcileTokens(redis, requestId, tokens)
  .catch((err) => {
    logger.error("Token reconciliation failed", err, {
      operation: "reconcileTokens",
      requestId,
      tokens,
    });
  });
```

**Why:** Even if the main flow succeeds, background operation failures should be visible for debugging and monitoring.

---

## Async Callback Error Handling

### Rule: Webhook Callbacks Should Always Return Success

Webhooks receive async results and should always return 200, even on errors.

#### ✅ Example: Webhook Controller

```typescript
export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { success, data, error } = req.body;

    if (success) {
      await processSuccessCallback(data);
    } else {
      await processErrorCallback(error);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    // Log error but still return 200
    logger.error("Webhook processing failed", error, {
      requestId: res.locals.requestId,
    });
    res.status(200).json({ received: true, error: true });
  }
};
```

**Why:** Webhook senders expect 200 to stop retrying. If we return 500, they'll keep resending the same callback.

---

## Error Metrics

### Rule: Record Error Metrics for Monitoring

Use Prometheus counters to track error rates by type.

```typescript
export const recordTaskCreationError = (errorType: string) => {
  taskCreationErrors.inc({
    error_type: errorType,
  });
};

// Usage
catch (error) {
  if (error instanceof BadRequestError) {
    recordTaskCreationError("bad_request");
  } else {
    recordTaskCreationError("internal_error");
  }
  throw error;
}
```

**Why:** Metrics help identify patterns (spike in vague input errors, AI service failures, etc.)

---

## Testing Error Scenarios

### Rule: Test Both Success and Error Paths

Every operation should have tests for common error scenarios.

```typescript
describe("createTask", () => {
  it("should create task successfully", async () => {
    // Happy path
  });

  it("should throw BadRequestError for empty input", async () => {
    await expect(createTask("", userId)).rejects.toThrow(BadRequestError);
  });

  it("should throw NotFoundError for invalid userId", async () => {
    mockedPrisma.task.create.mockRejectedValue(
      new Error("Foreign key constraint failed")
    );
    await expect(createTask(input, "invalid-id")).rejects.toThrow(InternalError);
  });

  it("should throw ServiceUnavailableError when AI service is down", async () => {
    mockedAiService.parseTask.mockRejectedValue(
      new ServiceUnavailableError("AI service unavailable")
    );
    await expect(createTask(input, userId)).rejects.toThrow(
      ServiceUnavailableError
    );
  });
});
```

---

## Summary Checklist

Before committing code with error handling:

- [ ] Uses typed errors from `@shared/errors`
- [ ] Includes requestId in error context
- [ ] Includes operation name in error context
- [ ] Logs errors with structured context
- [ ] Controllers pass errors to `next()`
- [ ] Services throw typed errors
- [ ] Fire-and-forget operations have `.catch()` handlers
- [ ] Webhooks always return 200
- [ ] Error scenarios are tested
- [ ] Error metrics are recorded (if applicable)
