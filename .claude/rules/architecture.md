# Architecture Patterns

This file documents architectural patterns and conventions specific to this project.

## Project Architecture Overview

**Async microservices architecture** with two services communicating via RabbitMQ.

```
Client
  ↓ POST /api/v1/tasks
Tasks Service (Express)
  ↓ POST /api/v1/capabilities/parse-task
AI Service (Express)
  ↓ Queue message
RabbitMQ
  ↓ Consume message
AI Consumer
  ↓ Call OpenAI API
OpenAI
  ↓ Callback with result
AI Consumer → Tasks Service (POST /api/v1/webhooks/create-task)
  ↓ Create task in DB
PostgreSQL
```

---

## Layered Architecture

### Rule: Follow Strict Layer Separation

**Layers (top to bottom):**
1. **Routes** - Express route definitions
2. **Middleware** - Request/response interceptors
3. **Controllers** - HTTP handling, validation, response formatting
4. **Services** - Business logic, orchestration
5. **Repositories** - Data access (Prisma)

**Dependency flow:** Routes → Middleware → Controllers → Services → Repositories

#### ❌ BAD - Controller Calls Repository Directly

```typescript
// tasks-controller.ts
export const getTasks = async (req: Request, res: Response) => {
  const tasks = await prisma.task.findMany({ where: { userId } });
  res.json({ tasks });
};
```

**Problem:** No business logic layer, tight coupling to database.

#### ✅ GOOD - Proper Layer Separation

```typescript
// tasks-controller.ts
export const getTasks = async (req: Request, res: Response) => {
  const userId = res.locals.userId;
  const tasks = await getTasksService(userId);
  res.json({ tasks });
};

// tasks-service.ts
export const getTasksService = async (userId: string): Promise<Task[]> => {
  return await findTasksByUserId(prisma, userId);
};

// tasks-repository.ts
export const findTasksByUserId = async (
  prisma: PrismaClient,
  userId: string
): Promise<Task[]> => {
  return await prisma.task.findMany({
    where: { userId },
    include: { subtasks: true },
    orderBy: { createdAt: "desc" },
  });
};
```

**Benefits:**
- Business logic separated from HTTP concerns
- Repository can be tested independently
- Easy to swap data source (Prisma → different ORM)

---

## Repository Pattern

### Rule: All Database Access Goes Through Repositories

**Repository responsibilities:**
- Execute database queries
- Handle Prisma-specific logic
- Return domain entities (Task, Subtask)

**Repository does NOT:**
- Contain business logic
- Handle HTTP concerns
- Throw HTTP status errors (use generic errors)

#### Repository Function Signature

**Always accept both PrismaClient and PrismaTransactionClient:**

```typescript
import type { PrismaClient } from "@prisma/client";
import type { PrismaTransactionClient } from "@shared/types";

export const createTask = async (
  prisma: PrismaClient | PrismaTransactionClient,
  data: CreateTaskData
): Promise<Task> => {
  return await prisma.task.create({
    data: {
      title: data.title,
      category: data.category,
      // ...
    },
  });
};
```

**Why:** Allows repositories to be used both standalone and within transactions.

#### Using Repositories in Transactions

```typescript
// services/webhooks-service.ts
export const createTaskWithSubtasks = async (
  data: WebhookData
): Promise<TaskWithSubtasks> => {
  return await prisma.$transaction(async (tx) => {
    const task = await createTask(tx, data.task);
    await createSubtasks(tx, task.id, data.subtasks);
    return await findTaskById(tx, task.id, data.userId);
  });
};
```

---

## Service Layer

### Rule: Business Logic Lives in Services

**Service responsibilities:**
- Implement business logic
- Orchestrate multiple operations
- Call external APIs
- Handle domain-specific errors
- Coordinate repositories and other services

**Service does NOT:**
- Handle HTTP requests/responses
- Format responses for clients
- Know about Express types (Request, Response)

#### ✅ Service Example

```typescript
// services/tasks-service/tasks-service.ts
export const createTaskHandler = async (
  requestId: string,
  naturalLanguage: string
): Promise<string> => {
  // Validate business rules
  if (!naturalLanguage.trim()) {
    throw new BadRequestError("Natural language input required");
  }

  // Prepare callback URL for async processing
  const callbackUrl = `${env.TASKS_SERVICE_URL}/api/v1/webhooks/create-task`;

  // Call AI service for async processing
  const aiRequestId = await executeCapability({
    capability: "parse-task",
    input: { naturalLanguage },
    callbackUrl,
    metadata: { tasksServiceRequestId: requestId },
  });

  return aiRequestId;
};
```

---

## Controller Layer

### Rule: Controllers Handle HTTP, Delegate to Services

**Controller responsibilities:**
- Extract data from request (body, params, query)
- Get validated data from `res.locals`
- Call service functions
- Format successful responses
- Pass errors to error handler (`next(error)`)

**Controller does NOT:**
- Contain business logic
- Access database directly
- Handle errors (except to add context)

#### ✅ Controller Example

```typescript
// controllers/tasks-controller/tasks-controller.ts
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { requestId, userId } = res.locals;
    const { naturalLanguage } = getValidatedInput<CreateTaskInput>(res);

    const aiRequestId = await createTaskHandler(requestId, naturalLanguage);

    res.status(StatusCodes.ACCEPTED).json({
      message: "Task is being processed",
      aiRequestId,
    });
  } catch (error) {
    next(error); // Error handler middleware formats response
  }
};
```

---

## Middleware Chain

### Rule: Follow Standard Middleware Order

**Order matters!** Middleware executes top-to-bottom:

```typescript
// app.ts
app.use(requestId());           // 1. Generate requestId
app.use(authentication());      // 2. Validate JWT token
app.use(requestResponseMetadata()); // 3. Record request start time
app.use("/api/v1/tasks", tasksRouter);

// tasksRouter
router.post(
  "/",
  tokenBucketRateLimiter.api,    // 4. Check rate limits
  validateSchema(createTaskSchema), // 5. Validate input
  createTaskController            // 6. Handle request
);

// After all routes
app.use(errorHandler);           // 7. Handle errors
```

**Why this order:**
1. **requestId** - Needed for all logging
2. **authentication** - Needed for rate limiting by user
3. **requestResponseMetadata** - Needed for timing metrics
4. **rateLimiter** - Block requests before processing
5. **validateSchema** - Validate before business logic
6. **controller** - Handle valid request
7. **errorHandler** - Catch all errors

---

## Higher-Order Wrappers

### Rule: Use Wrappers for Cross-Cutting Concerns

**Available wrappers:**

#### withRetry

**Use for:** External API calls (OpenAI, external services)

```typescript
import { withRetry } from "@shared/utils/with-retry";

const response = await withRetry(
  DEFAULT_RETRY_CONFIG,
  async () => {
    return await openai.responses.parse(prompt);
  },
  { operation: "callOpenAI", requestId }
);
```

**Config:**
```typescript
{
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
}
```

#### withLock

**Use for:** Operations with race conditions (token bucket, distributed state)

```typescript
import { withLock } from "@shared/utils/with-lock";

await withLock(redlock, lockKey, lockTtlMs, async () => {
  const bucket = await getTokenBucket(redis, bucketKey);
  await processTokenBucket(redis, bucket, bucketKey);
});
```

**Why:** Prevents concurrent modification of shared state.

#### withMetrics

**Use for:** Recording operation timing and success/failure

```typescript
import { withMetrics } from "@shared/utils/with-metrics";

const result = await withMetrics(
  recordCreateTaskDuration,
  startTime,
  async () => {
    return await createTaskService(data);
  },
  { success: true }
);
```

**Automatically records:**
- Duration histogram
- Success/failure counters

---

## Async Processing Pattern

### Request Path (Synchronous)

**Flow:**
1. Client sends request to Tasks Service
2. Rate limiter reserves tokens (with metadata in Redis)
3. Tasks Service forwards to AI Service
4. AI Service validates and queues to RabbitMQ
5. AI Service returns 202 Accepted immediately
6. Tasks Service returns 202 to client

**Key points:**
- Synchronous up to queueing
- Client gets immediate 202 response
- Tokens reserved upfront (rate limiting)
- Metadata stored in Redis (1-hour TTL)

### Callback Path (Asynchronous)

**Flow:**
1. AI Consumer picks up message from RabbitMQ
2. Consumer calls OpenAI API (waits for response)
3. Consumer calls Tasks Service webhook with result + token usage
4. Webhook creates task in DB (on success) or records error (on failure)
5. Webhook reconciles tokens (actual vs reserved) in background
6. Webhook cleans up metadata from Redis in background

**Key points:**
- Asynchronous processing
- Fire-and-forget token reconciliation
- Fire-and-forget metadata cleanup
- Always return 200 to webhook (even on error)

---

## Error Handling at Boundaries

### Rule: Transform Errors at Service Boundaries

**Service → Service:** Preserve full error context

```typescript
// AI Service
throw new BadRequestError("Vague input detected", {
  type: "VAGUE_INPUT_ERROR",
  input: naturalLanguage,
  requestId,
});

// Tasks Service receives error from AI Service
try {
  await aiService.executeCapability(input);
} catch (error) {
  // Log with full context
  logger.error("AI service error", error, { requestId });

  // Extract error info for token reconciliation
  const { tokens, errorType } = extractErrorInfo(error);

  // Reconcile tokens based on error type
  void reconcileTokens(redis, requestId, tokens);

  // Forward error to error handler
  throw error;
}
```

**Service → Client:** Strip internal context

```typescript
// tasks-error-handler.ts
export const tasksErrorHandler = (err: Error, req, res, next) => {
  const baseError = err as BaseError;

  // Log with full context (internal)
  logger.error("Request failed", baseError, {
    requestId: res.locals.requestId,
    context: baseError.context, // Internal details
  });

  // Return sanitized error to client
  res.status(baseError.statusCode || 500).json({
    error: {
      message: baseError.message,
      statusCode: baseError.statusCode,
      // NO internal context
    },
  });
};
```

---

## Validation Strategy

### Rule: Use Zod for All Input/Output Validation

**Define schemas:**
```typescript
// schemas/tasks-schemas.ts
export const createTaskSchema = z.object({
  body: z.object({
    naturalLanguage: z.string().min(1).max(500),
  }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>["body"];
```

**Validate in middleware:**
```typescript
router.post(
  "/tasks",
  validateSchema(createTaskSchema),
  createTaskController
);
```

**Access validated data:**
```typescript
const { naturalLanguage } = getValidatedInput<CreateTaskInput>(res);
```

**Why:**
- Type-safe validation
- Automatic error messages
- Single source of truth for types

---

## Path Aliases

### Rule: Use Path Aliases for Clean Imports

**Available aliases:**
```typescript
@shared/*       → ../../shared/src/*
@config/*       → src/config/*
@controllers/*  → src/controllers/*
@services/*     → src/services/*
@repositories/* → src/repositories/*
@middlewares/*  → src/middlewares/*
@clients/*      → src/clients/*
@schemas        → src/schemas
@types          → src/types
@mocks/*        → src/mocks/*
@consumers/*    → src/consumers/*
@metrics/*      → src/metrics/*
```

#### ❌ BAD - Relative Imports

```typescript
import { createLogger } from "../../../shared/src/config/create-logger";
import { createTask } from "../../repositories/tasks-repository";
```

#### ✅ GOOD - Path Aliases

```typescript
import { createLogger } from "@shared/config/create-logger";
import { createTask } from "@repositories/tasks-repository";
```

---

## Capability System (AI Service)

### Rule: Use Strategy Pattern for AI Capabilities

**Structure:**
```
capabilities/
  parse-task/
    handler/
      parse-task-handler.ts         # Implementation
      parse-task-handler.test.ts    # Tests
    prompts/
      core/
        v1/                          # Versioned prompts
      subtasks/
        v1/
    index.ts                         # Export handler
```

**Define capability:**
```typescript
// capabilities/parse-task/index.ts
export const parseTaskCapability: CapabilityConfig = {
  name: "parse-task",
  inputSchema: parseTaskInputSchema,
  outputSchema: parseTaskOutputSchema,
  promptInjectionFields: ["naturalLanguage"],
  handler: parseTaskHandler,
};
```

**Benefits:**
- Easy to add new capabilities
- Versioned prompts
- Consistent structure
- Testable in isolation

---

## Summary Checklist

Before adding new features:

- [ ] Follows layered architecture (Routes → Middleware → Controllers → Services → Repositories)
- [ ] Repositories accept PrismaClient | PrismaTransactionClient
- [ ] Business logic in services, not controllers
- [ ] Controllers delegate to services
- [ ] Middleware in correct order
- [ ] Uses higher-order wrappers (withRetry, withLock, withMetrics)
- [ ] Async processing follows request/callback pattern
- [ ] Errors transformed at service boundaries
- [ ] Input/output validated with Zod
- [ ] Path aliases used for imports
