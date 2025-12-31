---
name: Async AI Processing with RabbitMQ MVP
overview: Implement async AI processing using RabbitMQ. Tasks service validates input, calls AI service which validates and queues job, returns 202. Worker processes job, calls OpenAI, then calls Tasks service webhook endpoint with results. Tasks service webhook creates task and reconciles token usage. Metrics exclude 202 responses. Agent must get approval before each major section and update implementation doc after each section.
todos:
  - id: section-1-infra
    content: "Section 1: Infrastructure Setup - Add RabbitMQ to docker-compose, add environment variables (use envalid for AI, Zod for Tasks), create constants with barrel exports including DLQ name. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
  - id: section-2-rabbitmq-client
    content: "Section 2: AI Service - RabbitMQ Client - Add dependencies, create RabbitMQ client in clients/ directory with publishJob, createConsumer, and publishToDLQ functions. Create mocks. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
    dependencies:
      - section-1-infra
  - id: section-3-job-types
    content: "Section 3: AI Service - Job Payload Types - Create job payload type definitions with T prefix. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
    dependencies:
      - section-2-rabbitmq-client
  - id: section-4-async-executor
    content: "Section 4: AI Service - Async Pattern Executor - Update schemas, create async executor with proper error handling, update pattern router and controller. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
    dependencies:
      - section-3-job-types
  - id: section-5-worker
    content: "Section 5: AI Service - Worker Implementation - Create HTTP client in clients/tasks.ts, create worker service with retry logic (exponential backoff, max 3 retries), graceful shutdown (10s timeout), DLQ handling, integrate with server startup using initializeServer callbacks, create tests. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
    dependencies:
      - section-4-async-executor
  - id: section-6-webhook-types
    content: "Section 6: Tasks Service - Webhook Types and Schemas - Create webhook types (no T prefix for DTOs) and validation schemas with Zod refinements. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
    dependencies:
      - section-5-worker
  - id: section-7-webhook-impl
    content: "Section 7: Tasks Service - Webhook Endpoint Implementation - Create webhook controller (extract userId, override auth context), router with error handlers (NO metrics middleware), register in routers. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
    dependencies:
      - section-6-webhook-types
  - id: section-8-async-flow
    content: "Section 8: Tasks Service - Async Flow Implementation - Update types to support async pattern with discriminated union, update tasks service to always use async, update controller and AI capabilities service with type narrowing. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
    dependencies:
      - section-7-webhook-impl
  - id: section-9-metrics
    content: "Section 9: Metrics Updates - Update shared metrics middleware to exclude 202 responses with comment explaining rationale. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
    dependencies:
      - section-8-async-flow
  - id: section-10-testing-docs
    content: "Section 10: Testing and Documentation - Create integration tests, update existing tests, update README. Then run validation and update implementation doc. WAIT FOR APPROVAL before proceeding."
    status: pending
    dependencies:
      - section-9-metrics
---

# Async AI Processing with RabbitMQ MVP

## Overview

This plan implements async AI processing using RabbitMQ. The flow: (1) Client → Tasks (input validation), (2) Tasks → AI Service, (3) AI Service validates (prompt injection, schema), (4) AI Service creates job in RabbitMQ, (5) AI Service returns 202 to Tasks, (6) Tasks returns 202 to client, (7) Worker processes job, calls OpenAI, then calls Tasks service webhook endpoint, (8) Tasks service webhook creates task and reconciles token usage. Token usage is reserved before queueing and reconciled in webhook callback.

## Important Instructions for Agent

**CRITICAL WORKFLOW**:

1. **Before starting each major section**: Wait for user approval before proceeding
2. **After completing each major section**:

- Run `npm run type-check:ci` to verify TypeScript compilation
- Run `npm run test` to verify all tests pass
- Update the implementation doc (`docs/implementations/async-ai-processing-rabbitmq.md`) with:
    - What was implemented
    - Files created/modified
    - Any issues encountered
    - Test results
- Request approval from user before proceeding to next section

3. **If errors occur**: Document them in the implementation doc and wait for user guidance

## Architecture Flow

```mermaid
sequenceDiagram
    participant Client
    participant TasksService
    participant TokenRL as Token Usage Rate Limiter
    participant AIService
    participant RabbitMQ
    participant Worker
    participant OpenAI
    participant TasksWebhook as Tasks Service<br/>Webhook Endpoint

    Client->>TasksService: POST /api/v1/tasks { naturalLanguage }
    TasksService->>TasksService: Input validation (schema)
    TasksService->>TokenRL: Reserve estimated tokens
    TokenRL-->>TasksService: Reservation confirmed
    TasksService->>AIService: POST /api/v1/capabilities/parse-task?pattern=async
    AIService->>AIService: Validate executable capability
    AIService->>AIService: Validate input schema
    AIService->>AIService: Validate prompt injection
    AIService->>RabbitMQ: Publish job (with token reservation info)
    RabbitMQ-->>AIService: Job queued
    AIService-->>TasksService: 202 Accepted
    TasksService-->>Client: 202 Accepted
    
    RabbitMQ->>Worker: Consume job
    Worker->>OpenAI: Process capability
    OpenAI-->>Worker: Response + actual tokens
    Worker->>TasksWebhook: POST /api/v1/webhooks (result + tokens + reservation info)
    TasksWebhook->>TasksWebhook: Validate schema
    TasksWebhook->>TokenRL: Reconcile actual tokens
    TasksWebhook->>TasksService: Create task in DB
    TasksService-->>TasksWebhook: Task created
    TasksWebhook-->>Worker: 201 Created
```

**Note**: The webhook endpoint (`/api/v1/webhooks`) is part of the Tasks service. The diagram shows it separately for clarity, but it's the same Tasks service handling the webhook callback from the worker.

## Clarifications

### 1. Authentication for Webhook

**Issue**: The webhook needs `userId` from the payload, but the `authentication` middleware runs before the controller and currently hardcodes `userId = 1`.**Solution**: Extract `userId` from the validated webhook payload in the controller and set `res.locals.authenticationContext = { userId }` before token reconciliation needs it. The authentication middleware will set it to 1 initially, but we override it in the controller. This works because:

- Authentication middleware sets `res.locals.authenticationContext = { userId: 1 }`
- Controller extracts `userId` from validated payload
- Controller sets `res.locals.authenticationContext = { userId: extractedUserId }`
- Token reconciliation middleware uses `getAuthenticationContext(res)` which will get the overridden value

**Implementation**: In `webhook-controller.ts`, after extracting validated body, set `res.locals.authenticationContext = { userId: body.userId }` before calling token reconciliation.

### 2. Webhook Metrics

**Decision**: Webhook requests should NOT be tracked separately. They are internal callbacks and should not appear in metrics. The webhook router should NOT include metrics middleware.**Rationale**:

- Webhooks are internal service-to-service calls
- The original `create_task` operation is already tracked (returns 202)
- Tracking webhooks separately would double-count operations
- Webhook success/failure is part of the async flow, not a separate operation

**Implementation**: Do NOT add `tasksMetricsMiddleware` to webhook router. Only add error handlers and token usage middleware.

### 3. Worker Retry Strategy

**Details and Best Practices**:**Retry Configuration**:

- **Max Retries**: 3 attempts for transient failures
- **Retry Backoff**: Exponential backoff with jitter
- Initial delay: 1 second
- Max delay: 30 seconds
- Formula: `min(initialDelay * 2^attempt, maxDelay) + jitter`
- Jitter: Random 0-1 second to prevent thundering herd

**What to Retry**:

- **OpenAI API Errors**: 
- Retry: Rate limits (429), server errors (500, 502, 503), timeouts
- Don't retry: Client errors (400, 401, 403), invalid requests
- Pros: Handles transient OpenAI issues
- Cons: May delay error reporting for permanent failures
- **Webhook Callback Errors**:
- Retry: Network errors, timeouts, 5xx errors from Tasks service
- Don't retry: 4xx errors (bad request, validation errors)
- Pros: Handles transient network/service issues
- Cons: May retry invalid requests unnecessarily

**Dead Letter Queue (DLQ)**:

- **When to DLQ**: After max retries exhausted, or permanent failures (4xx errors)
- **DLQ Configuration**: 
- Queue name: `ai-capability-jobs-dlq`
- Message TTL: 7 days (for manual inspection)
- Store full job payload and error details
- **Pros**: 
- Prevents infinite retry loops
- Allows manual inspection of failed jobs
- Can replay jobs after fixing issues
- **Cons**: 
- Requires manual intervention
- Adds complexity
- May accumulate if not monitored

**Implementation Approach**:

- Use `withRetry` utility from shared package (if available) or implement custom retry logic
- Log each retry attempt with attempt number and delay
- After max retries, publish to DLQ with error details
- For MVP: Simple retry loop with exponential backoff is sufficient

### 4. Worker Graceful Shutdown

**Details and Best Practices**:**Shutdown Signals**:

- Listen for: `SIGTERM`, `SIGINT` (standard process signals)
- Also handle: `SIGUSR2` if used by process manager

**Graceful Shutdown Flow**:

1. **Stop Accepting New Jobs**: 

- Cancel consumer subscription
- Close RabbitMQ channel
- Pros: Prevents new work from starting during shutdown
- Cons: May need to wait for in-flight jobs

2. **Wait for In-Flight Jobs**:

- Track active job promises
- Wait for all to complete (with timeout)
- Timeout: 30 seconds max wait
- Pros: Ensures jobs complete successfully
- Cons: May delay shutdown if jobs are slow

3. **Close Connections**:

- Close RabbitMQ connection
- Close HTTP client connections
- Pros: Clean resource cleanup
- Cons: None significant

4. **Exit Process**:

- Call `process.exit(0)` on success
- Call `process.exit(1)` on timeout/error

**Implementation Approach**:

- Use `process.on('SIGTERM', ...)` and `process.on('SIGINT', ...)`
- Track active jobs in a Set or Map
- Use Promise.race with timeout for graceful shutdown
- Log shutdown progress for observability

**Pros of Graceful Shutdown**:

- Prevents job loss during restarts
- Ensures data consistency
- Better user experience (jobs complete)

**Cons of Graceful Shutdown**:

- Adds complexity
- May delay deployment/restart
- Timeout handling needed

**For MVP**: Implement basic graceful shutdown:

- Stop consumer on signal
- Wait 10 seconds for in-flight jobs
- Close connections
- Exit

### 5. Type Safety for Async Pattern

**Issue**: `TExecuteCapabilityConfig` is a union type (`sync | async`), and TypeScript needs to narrow the type correctly when using it.**Solution**: Use type guards or discriminated unions. The union type already discriminates by `pattern` field:

```typescript
type TExecuteCapabilityConfig = 
  | { pattern: "sync"; ... }
  | { pattern: "async"; ... }
```

**Implementation**: In `ai-capabilities-service.ts`, check `config.pattern === "async"` to narrow the type:

```typescript
if (config.pattern === "async") {
  // TypeScript knows config has async-specific fields
  const { callbackUrl, userId, tokenReservation } = config.params;
  // ... use async fields
} else {
  // TypeScript knows config has sync fields
  // ... use sync fields
}
```

**No Issue**: This is standard TypeScript pattern matching and should work correctly.

## Implementation Sections

### Section 1: Infrastructure Setup ⏸️ REQUIRES APPROVAL

**Scope**: Docker Compose, environment variables, and constants**Tasks**:

1. Add RabbitMQ service to `docker-compose.yml` and `docker-compose.dev.yml`:

- Image: `rabbitmq:3-management-alpine`
- Ports: `5672:5672` (AMQP), `15672:15672` (management UI)
- Environment: `RABBITMQ_DEFAULT_USER=guest`, `RABBITMQ_DEFAULT_PASS=guest`
- Healthcheck: Check port 5672

2. Add `RABBITMQ_URL` to AI service `.env.example` (format: `amqp://guest:guest@rabbitmq:5672`)
3. Add `RABBITMQ_URL` to AI service `config/env.ts`:

- Use `str()` from envalid (AI service uses envalid, not Zod)
- Add to env schema

4. Add `TASKS_SERVICE_BASE_URL` to Tasks service `.env.example` (format: `http://tasks:3001` for docker, `http://localhost:3001` for local)
5. Add `TASKS_SERVICE_BASE_URL` to Tasks service `config/env.ts`:

- Use Zod validation (Tasks service uses Zod)
- Add `z.string().url()` to env schema

6. Create `backend/services/ai/src/constants/rabbitmq.ts`:

- Export `RABBITMQ_QUEUE_NAME = "ai-capability-jobs" as const`
- Export `RABBITMQ_DLQ_NAME = "ai-capability-jobs-dlq" as const` (for future DLQ)
- Follow constants naming pattern (SCREAMING_SNAKE_CASE)

7. Update `backend/services/ai/src/constants/index.ts`:

- Export `RABBITMQ_QUEUE_NAME` and `RABBITMQ_DLQ_NAME` from `./rabbitmq`
- Follow barrel export pattern

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`

**Implementation Doc Update**:

- Document RabbitMQ service configuration
- Document environment variables added
- Document constants created

**Files to Create**:

- `backend/services/ai/src/constants/rabbitmq.ts`

**Files to Modify**:

- `docker-compose.yml`
- `docker-compose.dev.yml`
- `backend/services/ai/.env.example`
- `backend/services/ai/src/config/env.ts`
- `backend/services/tasks/.env.example`
- `backend/services/tasks/src/config/env.ts`
- `backend/services/ai/src/constants/index.ts`

---

### Section 2: AI Service - RabbitMQ Client ⏸️ REQUIRES APPROVAL

**Scope**: RabbitMQ client implementation and mocks**Tasks**:

1. Add RabbitMQ dependencies to `backend/services/ai/package.json`:

- `"amqp-connection-manager": "^4.1.14"`
- `"amqplib": "^0.10.4"`
- `"@types/amqplib": "^0.10.4"` to devDependencies

2. Run `npm install` in `backend/services/ai`
3. Create `backend/services/ai/src/clients/rabbitmq.ts`:

- Import `amqp-connection-manager` and `amqplib`
- Import `env` from `@config/env`
- Import `RABBITMQ_QUEUE_NAME, RABBITMQ_DLQ_NAME` from `@constants`
- Import `createLogger` from `@shared/config/create-logger`
- Create connection using `amqp-connection-manager.connect(env.RABBITMQ_URL)`
- Export `publishJob(queueName: string, jobData: unknown): Promise<void>`:
    - Get channel from connection
    - Assert queue exists (durable: true)
    - Publish message to queue (JSON stringify jobData, persistent: true)
    - Handle errors and log appropriately
    - Use structured logging with requestId if available
- Export `createConsumer(queueName: string, handler: (msg: unknown) => Promise<void>): Promise<void>`:
    - Get channel from connection
    - Assert queue exists (durable: true)
    - Consume messages from queue (noAck: false for manual acknowledgment)
    - Parse JSON message
    - Call handler for each message
    - Acknowledge message after successful processing
    - Reject message (requeue: false) on permanent failures
    - Reject message (requeue: true) on transient failures (for retry)
    - Handle errors and log appropriately
- Export `publishToDLQ(queueName: string, jobData: unknown, error: Error): Promise<void>`:
    - Publish failed job to DLQ with error details
    - Use for permanent failures after retries
- Handle connection errors and reconnections
- Use structured logging following project patterns

4. Create `backend/services/ai/src/mocks/rabbitmq-mock.ts`:

- Export mock functions for `publishJob`, `createConsumer`, and `publishToDLQ`
- Use `vi.fn()` for testing
- Follow mock file naming pattern

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`

**Implementation Doc Update**:

- Document RabbitMQ client implementation
- Document connection management approach
- Document mock implementation
- Document DLQ support

**Files to Create**:

- `backend/services/ai/src/clients/rabbitmq.ts`
- `backend/services/ai/src/mocks/rabbitmq-mock.ts`

**Files to Modify**:

- `backend/services/ai/package.json`

---

### Section 3: AI Service - Job Payload Types ⏸️ REQUIRES APPROVAL

**Scope**: Type definitions for job payloads**Tasks**:

1. Create `backend/services/ai/src/types/job-payload.ts`:

- Import `Capability` from `@types`
- Define `TCapabilityJobPayload` type (use `T` prefix for domain types):
     ```typescript
                                   export type TCapabilityJobPayload = {
                                     capability: Capability;
                                     input: unknown; // validated input, including naturalLanguage and config
                                     callbackUrl: string;
                                     requestId: string;
                                     userId: number;
                                     tokenReservation?: {
                                       tokensReserved: number;
                                       windowStartTimestamp: number;
                                     };
                                   };
     ```




2. Update `backend/services/ai/src/types/index.ts`:

- Export `TCapabilityJobPayload` from `./job-payload`
- Follow barrel export pattern

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`

**Implementation Doc Update**:

- Document job payload structure
- Document type definitions

**Files to Create**:

- `backend/services/ai/src/types/job-payload.ts`

**Files to Modify**:

- `backend/services/ai/src/types/index.ts`

---

### Section 4: AI Service - Async Pattern Executor ⏸️ REQUIRES APPROVAL

**Scope**: Async pattern executor that publishes jobs to RabbitMQ**Tasks**:

1. Update `backend/services/ai/src/capabilities/parse-task/parse-task-schemas.ts`:

- Add optional fields for async pattern:
    - `callbackUrl?: z.string().url()`
    - `userId?: z.number().int().positive()`
    - `tokenReservation?: z.object({ tokensReserved: z.number(), windowStartTimestamp: z.number() })`
- Keep existing `naturalLanguage` and `config` fields
- Note: These fields are conditionally required based on pattern (validation happens in executor)

2. Create `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/` directory
3. Create `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/execute-async-pattern.ts`:

- Import `withDurationAsync` from `@shared/utils/with-duration`
- Import `publishJob` from `@clients/rabbitmq`
- Import `RABBITMQ_QUEUE_NAME` from `@constants`
- Import `TCapabilityJobPayload` from `@types`
- Import `createLogger` from `@shared/config/create-logger`
- Import `BadRequestError, InternalError` from `@shared/errors`
- Follow pattern executor signature: `(config, input, requestId) => Promise<{ result, durationMs }>`
- Extract `callbackUrl`, `userId`, and `tokenReservation` from input body
- Validate required fields are present (throw BadRequestError if missing)
- Create job payload: `TCapabilityJobPayload`
- Publish job to RabbitMQ using `publishJob(RABBITMQ_QUEUE_NAME, jobPayload)`
- Wait for successful queue publication
- Return `{ result: {}, durationMs }` (minimal result, duration is queue time only)
- Handle errors: throw `InternalError` on queue failures
- Use structured logging with requestId

4. Create `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/index.ts`:

- Export `executeAsyncPattern` from `./execute-async-pattern`
- Follow barrel export pattern

5. Update `backend/services/ai/src/controllers/capabilities-controller/executors/get-pattern-executor/get-pattern-executor.ts`:

- Import `executeAsyncPattern` from `@controllers/capabilities-controller/executors/execute-async-pattern`
- Replace `async` case to return `executeAsyncPattern` instead of throwing error
- Use path alias `@controllers/*`

6. Update `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`:

- Check if pattern is async (from validatedInput.query.pattern)
- If async, return 202 Accepted instead of 200 OK
- Include minimal response: `{ aiServiceRequestId: requestId }`
- Keep existing 200 OK response for sync pattern

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`

**Implementation Doc Update**:

- Document async pattern executor implementation
- Document job publishing flow
- Document 202 response handling

**Files to Create**:

- `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/execute-async-pattern.ts`
- `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/index.ts`

**Files to Modify**:

- `backend/services/ai/src/capabilities/parse-task/parse-task-schemas.ts`
- `backend/services/ai/src/controllers/capabilities-controller/executors/get-pattern-executor/get-pattern-executor.ts`
- `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`

---

### Section 5: AI Service - Worker Implementation ⏸️ REQUIRES APPROVAL

**Scope**: Worker that consumes jobs, processes them, and calls Tasks service webhook**Tasks**:

1. Add `TASKS_SERVICE_BASE_URL` to AI service `config/env.ts`:

- Use `str()` from envalid
- Add to env schema

2. Create `backend/services/ai/src/clients/tasks.ts`:

- Import `env` from `@config/env`
- Import `createHttpClient` from `@shared/clients/http`
- Create HTTP client: `createHttpClient(env.TASKS_SERVICE_BASE_URL, `http://${env.SERVICE_NAME}:${env.SERVICE_PORT}`)`
- Export `tasksClient` (follow existing pattern from `clients/ai.ts` in tasks service)

3. Create `backend/services/ai/src/workers/` directory (new pattern, not in conventions but needed for workers)
4. Create `backend/services/ai/src/workers/capability-worker.ts`:

- Import `createConsumer, publishToDLQ` from `@clients/rabbitmq`
- Import `RABBITMQ_QUEUE_NAME, RABBITMQ_DLQ_NAME` from `@constants`
- Import `capabilities` from `@capabilities`
- Import `TCapabilityJobPayload` from `@types`
- Import `tasksClient` from `@clients/tasks`
- Import `createLogger` from `@shared/config/create-logger`
- Import `executeSyncPattern` from `@controllers/capabilities-controller/executors/execute-sync-pattern`
- Import `isHttpError` from `@shared/clients/http`
- Import `InternalError, BadRequestError` from `@shared/errors`
- Import `AI_ERROR_TYPE` from `@constants`
- Track active jobs: `const activeJobs = new Set<Promise<void>>()`
- Implement retry logic helper:
    - `retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number): Promise<T>`
    - Exponential backoff: `min(1000 * Math.pow(2, attempt), 30000) + Math.random() * 1000`
    - Retry on transient errors, throw on permanent errors
- Implement `processJob(jobPayload: TCapabilityJobPayload): Promise<void>`:
    - Extract capability, input, callbackUrl, requestId, userId, tokenReservation
    - Get capability config from capabilities registry
    - Try-catch for capability execution:
    - Execute capability handler using `executeSyncPattern` (reuse sync logic)
    - Extract actual token usage from result.openaiMetadata
    - On success: POST to callbackUrl using `tasksClient.post()` with retry:
        - URL: `/api/v1/webhooks`
        - Headers: `{ "x-request-id": requestId }`
        - Body: success payload
        - Retry on transient failures (5xx, network errors)
        - Don't retry on 4xx (permanent failures)
    - On failure: Extract error details and POST to callbackUrl:
        - Retry on transient failures
        - Send error payload with proper structure
    - Handle errors: Log and publish to DLQ after max retries
    - Use structured logging with requestId
- Implement `startWorker(): Promise<void>`:
    - Set up graceful shutdown handlers:
    - `process.on('SIGTERM', handleShutdown)`
    - `process.on('SIGINT', handleShutdown)`
    - `handleShutdown` function:
    - Log "Shutting down worker gracefully"
    - Stop consumer (cancel subscription)
    - Wait for active jobs to complete (max 10 seconds timeout)
    - Close RabbitMQ connection
    - Log "Worker shutdown complete"
    - Exit process
    - Start consuming from queue using `createConsumer(RABBITMQ_QUEUE_NAME, processJob)`
    - Track active jobs in Set
    - Log worker startup

5. Create `backend/services/ai/src/workers/start-worker.ts`:

- Import `startWorker` from `./capability-worker`
- Import `createLogger` from `@shared/config/create-logger`
- Export `initializeWorker(): Promise<void>`:
    - Log "Starting capability worker"
    - Call `startWorker()`
    - Handle errors and log appropriately

6. Update `backend/services/ai/src/server.ts`:

- Import `initializeWorker` from `@workers/start-worker`
- Update `initializeServer` call to include `startCallback`:
    - Call `initializeWorker()` in startCallback
    - Follow existing pattern from tasks service server.ts

7. Create `backend/services/ai/src/workers/capability-worker.test.ts`:

- Mock RabbitMQ client
- Mock HTTP client (tasksClient)
- Mock capability execution
- Test job processing success path
- Test job processing failure path
- Test callback URL errors and retries
- Test graceful shutdown
- Follow existing test patterns
- Use `vi.hoisted` for module-level mocks

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`

**Implementation Doc Update**:

- Document worker implementation
- Document job processing flow
- Document webhook callback to Tasks service
- Document retry strategy with exponential backoff
- Document graceful shutdown implementation
- Document HTTP client setup
- Document request ID propagation
- Document server startup integration
- Document DLQ handling

**Files to Create**:

- `backend/services/ai/src/clients/tasks.ts`
- `backend/services/ai/src/workers/capability-worker.ts`
- `backend/services/ai/src/workers/start-worker.ts`
- `backend/services/ai/src/workers/capability-worker.test.ts`

**Files to Modify**:

- `backend/services/ai/src/config/env.ts` (add TASKS_SERVICE_BASE_URL)
- `backend/services/ai/src/server.ts`

---

### Section 6: Tasks Service - Webhook Types and Schemas ⏸️ REQUIRES APPROVAL

**Scope**: Type definitions and validation schemas for webhook endpoint**Tasks**:

1. Create `backend/services/tasks/src/types/webhook-controller-input.ts`:

- Import `webhookCallbackSchema` from `@schemas/webhook-schemas` (will create in next step)
- Import `z` from `zod`
- Export `WebhookCallbackInput = z.infer<typeof webhookCallbackSchema>`
- Follow type definition pattern (no T prefix for DTOs)

2. Create `backend/services/tasks/src/types/webhook-controller-response.ts`:

- Import `TaskResponse` from `@types/task-response`
- Export `WebhookCallbackResponse` type:
     ```typescript
                                   export type WebhookCallbackResponse = {
                                     tasksServiceRequestId: string;
                                     task: TaskResponse;
                                   };
     ```




3. Create `backend/services/tasks/src/schemas/webhook-schemas.ts`:

- Import `z` from `zod`
- Import `TParsedTask` and `TOpenaiMetadata` from `@types`
- Define `webhookCallbackSchema = z.object({ body: z.object({ ... }) })`:
    - `aiServiceRequestId: z.string()`
    - `userId: z.number().int().positive()`
    - `naturalLanguage: z.string()`
    - `result: TParsedTask` (when status is "success", use conditional schema)
    - `openaiMetadata: z.record(z.string(), z.object({ ... }))` (TOpenaiMetadata structure)
    - `status: z.enum(["success", "failure"])`
    - `error?: z.object({ message: z.string(), type: z.string().optional() })` (when status is "failure")
    - `tokenReservation?: z.object({ tokensReserved: z.number(), windowStartTimestamp: z.number() })`
- Use Zod refinement to validate result is present when status is "success"
- Use Zod refinement to validate error is present when status is "failure"
- Follow schema definition pattern from project conventions

4. Update `backend/services/tasks/src/types/index.ts`:

- Export `WebhookCallbackInput` from `./webhook-controller-input`
- Export `WebhookCallbackResponse` from `./webhook-controller-response`
- Follow barrel export pattern

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`

**Implementation Doc Update**:

- Document webhook types
- Document webhook schema validation
- Document token reservation handling in schema

**Files to Create**:

- `backend/services/tasks/src/types/webhook-controller-input.ts`
- `backend/services/tasks/src/types/webhook-controller-response.ts`
- `backend/services/tasks/src/schemas/webhook-schemas.ts`

**Files to Modify**:

- `backend/services/tasks/src/types/index.ts`

---

### Section 7: Tasks Service - Webhook Endpoint Implementation ⏸️ REQUIRES APPROVAL

**Scope**: Webhook controller and router (Tasks service endpoint)**Tasks**:

1. Create `backend/services/tasks/src/controllers/webhook-controller/` directory
2. Create `backend/services/tasks/src/controllers/webhook-controller/webhook-controller.ts`:

- Import `NextFunction, Request, Response` from `express`
- Import `StatusCodes` from `http-status-codes`
- Import `createLogger` from `@shared/config/create-logger`
- Import `WebhookCallbackInput, WebhookCallbackResponse` from `@types`
- Import `prisma` from `@clients/prisma`
- Import `createTask, createManySubtasks, findTaskById` from `@repositories/tasks-repository`
- Import `taskToResponseDto` from `@utils/task-to-response-dto`
- Import `extractOpenaiTokenUsage` from `@utils/extract-openai-token-usage`
- Implement `handleWebhookCallback`:
    - Extract `requestId` from `res.locals`
    - Extract validated body from request (will be set by validateSchema middleware)
    - Extract `userId`, `naturalLanguage`, `result`, `openaiMetadata`, `status`, `error`, `tokenReservation`
    - **Set authentication context**: `res.locals.authenticationContext = { userId }` (override hardcoded value from authentication middleware)
    - Set `res.locals.tokenUsage` with:
    - `tokensReserved`: from tokenReservation (if provided)
    - `windowStartTimestamp`: from tokenReservation (if provided)
    - `actualTokens`: extracted from openaiMetadata using `extractOpenaiTokenUsage`
    - Log "Handle webhook callback - starting" with baseLogContext
    - If status is "success":
    - Create task in database using transaction:
        - Call `createTask` with userId, naturalLanguage, result
        - If result.subtasks exists, call `createManySubtasks`
        - Call `findTaskById` to get task with subtasks
    - Log "Handle webhook callback - succeeded"
    - Return 201 Created with task data: `{ tasksServiceRequestId: requestId, task: taskToResponseDto(task) }`
    - If status is "failure":
    - Log error details
    - Return 201 Created with error acknowledgment (or handle differently based on requirements)
    - Call `next()` to continue to post-response middleware (token usage reconciliation)
    - Handle errors: pass to error handler via `next(error)`
- Follow controller pattern from project conventions

3. Create `backend/services/tasks/src/controllers/webhook-controller/index.ts`:

- Export `handleWebhookCallback` from `./webhook-controller`
- Follow barrel export pattern

4. Create `backend/services/tasks/src/routers/webhook-router.ts`:

- Import `Router` from `express`
- Import `handleWebhookCallback` from `@controllers/webhook-controller`
- Import `validateSchema` from `@shared/middlewares/validate-schema`
- Import `webhookCallbackSchema` from `@schemas/webhook-schemas`
- Import `tasksErrorHandler` from `@middlewares/tasks-error-handler`
- Import `tokenUsageErrorHandler` from `@middlewares/token-usage-error-handler`
- Import `openaiUpdateTokenUsage` from `@middlewares/token-usage-rate-limiter`
- Create router: `export const webhookRouter = Router()`
- **Do NOT add metrics middleware** (webhooks are internal callbacks, not tracked separately)
- Add route: `webhookRouter.post("/", [validateSchema(webhookCallbackSchema), handleWebhookCallback, openaiUpdateTokenUsage])`
- Add error handlers: `webhookRouter.use(tasksErrorHandler)` and `webhookRouter.use(tokenUsageErrorHandler)`
- Follow router pattern from tasks-router.ts

5. Update `backend/services/tasks/src/routers/index.ts`:

- Import `webhookRouter` from `./webhook-router`
- Add route: `routers.use("/api/v1/webhooks", [requestId, authentication, requestResponseMetadata], webhookRouter)`
- Follow existing router pattern

6. Create `backend/services/tasks/src/controllers/webhook-controller/webhook-controller.test.ts`:

- Mock repositories
- Mock token usage extraction
- Test success path
- Test failure path
- Test token usage reconciliation
- Test userId extraction and authentication context setup
- Follow existing test patterns
- Use `vi.hoisted` for module-level mocks

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`

**Implementation Doc Update**:

- Document webhook endpoint implementation (Tasks service)
- Document task creation in webhook
- Document token usage reconciliation in webhook
- Document router setup with error handlers (no metrics)
- Document userId extraction and authentication context setup

**Files to Create**:

- `backend/services/tasks/src/controllers/webhook-controller/webhook-controller.ts`
- `backend/services/tasks/src/controllers/webhook-controller/index.ts`
- `backend/services/tasks/src/controllers/webhook-controller/webhook-controller.test.ts`
- `backend/services/tasks/src/routers/webhook-router.ts`

**Files to Modify**:

- `backend/services/tasks/src/routers/index.ts`

---

### Section 8: Tasks Service - Async Flow Implementation ⏸️ REQUIRES APPROVAL

**Scope**: Update tasks service to always use async pattern**Tasks**:

1. Update `backend/services/tasks/src/types/ai-capability.ts`:

- Update `TExecuteCapabilityConfig` to support async pattern using discriminated union:
     ```typescript
                                   export type TExecuteCapabilityConfig<TCapability extends TAiCapability> = 
                                     | { capability: TCapability; pattern: "sync"; params: TAiCapabilityMap[TCapability]["params"] }
                                     | { capability: TCapability; pattern: "async"; params: TAiCapabilityMap[TCapability]["params"] & { callbackUrl: string; userId: number; tokenReservation?: { tokensReserved: number; windowStartTimestamp: number } } };
     ```




- Use union type pattern with `pattern` as discriminator

2. Update `backend/services/tasks/src/services/tasks-service/tasks-service.ts`:

- Import `env` from `@config/env`
- Update `createTaskHandler` signature to accept `tokenUsage` parameter:
    - `createTaskHandler(requestId: string, userId: number, naturalLanguage: string, tokenUsage?: { tokensReserved: number; windowStartTimestamp: number })`
- Update `createTaskHandler` to:
    - Always use async pattern (remove sync logic or keep as fallback)
    - Extract `userId` from parameters
    - Construct `callbackUrl` from `env.TASKS_SERVICE_BASE_URL + "/api/v1/webhooks"`
    - Call `executeCapability` with:
    - `pattern: "async"`
    - `params: { naturalLanguage, config: DEFAULT_PARSE_TASK_CONFIG, callbackUrl, userId, tokenReservation: tokenUsage ? { tokensReserved: tokenUsage.tokensReserved, windowStartTimestamp: tokenUsage.windowStartTimestamp } : undefined }`
    - Handle 202 Accepted response (expected, don't throw error)
    - Return minimal response (just indication that job was queued)
    - Remove database operations (moved to webhook)
    - Remove token usage extraction (moved to webhook)

3. Update `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`:

- Update `createTask` to:
    - Extract `tokenUsage` from `res.locals` (set by token usage rate limiter middleware)
    - Pass `tokenUsage` to `createTaskHandler` (if available)
    - Handle 202 Accepted response from handler
    - Return 202 with response body: `{ tasksServiceRequestId: requestId }`
    - Do NOT call `next()` for post-response middleware (token usage reconciliation happens in webhook)
    - Log: "Create task (async) - starting", "Create task (async) - succeeded"

4. Update `backend/services/tasks/src/services/ai-capabilities-service/ai-capabilities-service.ts`:

- Update `executeCapability` to handle async pattern:
    - Use type guard: `if (config.pattern === "async")` to narrow type
    - Include `callbackUrl`, `userId`, and `tokenReservation` in request body when async
    - Include `requestId` in headers (`x-request-id`)
    - Handle 202 Accepted response (should not throw error, return response data)
    - Update return type to handle both 200 and 202 responses:
    - For 200: return `TAiCapabilityResponse<TResult>`
    - For 202: return `{ aiServiceRequestId: string }`
    - Use union return type or make response fields optional
- Update error handling to distinguish between 202 (expected) and other status codes

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`

**Implementation Doc Update**:

- Document async flow implementation
- Document callback URL construction
- Document token reservation passing
- Document 202 response handling
- Document type narrowing for async pattern

**Files to Modify**:

- `backend/services/tasks/src/types/ai-capability.ts`
- `backend/services/tasks/src/services/tasks-service/tasks-service.ts`
- `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`
- `backend/services/tasks/src/services/ai-capabilities-service/ai-capabilities-service.ts`

---

### Section 9: Metrics Updates ⏸️ REQUIRES APPROVAL

**Scope**: Exclude 202 responses from metrics**Tasks**:

1. Update `backend/shared/src/middlewares/metrics/metrics-middleware.ts`:

- Import `StatusCodes` from `http-status-codes`
- In the `res.on("finish")` handler, add check before recording:
     ```typescript
                                   if (res.statusCode === StatusCodes.ACCEPTED) {
                                     return; // Skip metrics for 202 Accepted responses
                                   }
     ```




- This prevents async requests from skewing success rate and duration metrics
- Add comment explaining why 202 is excluded

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`

**Implementation Doc Update**:

- Document metrics exclusion for 202
- Document rationale (async requests are queued, not completed)

**Files to Modify**:

- `backend/shared/src/middlewares/metrics/metrics-middleware.ts`

---

### Section 10: Testing and Documentation ⏸️ REQUIRES APPROVAL

**Scope**: Integration tests, test updates, and documentation**Tasks**:

1. Create integration tests for full async flow:

- Test: Client → Tasks → AI → Queue → Worker → Webhook → Database
- Test token usage reservation and reconciliation
- Test error scenarios (queue failure, callback failure, worker failure)
- Use testcontainers or mock RabbitMQ

2. Update existing tests that may be affected:

- Tasks controller tests (now returns 202)
- Tasks service tests (now uses async)
- AI capabilities service tests (handles 202)

3. Update README.md:

- Update architecture diagram
- Document async flow
- Document webhook endpoint (internal, not for clients)
- Document token usage handling
- Update API examples (show 202 response)
- Document RabbitMQ setup

**Validation**:

- Run `npm run type-check:ci`
- Run `npm run test`
- Review documentation

**Implementation Doc Update**:

- Document integration tests
- Document test updates
- Document README updates

**Files to Create**:

- Integration test files (as needed)

**Files to Modify**:

- Existing test files (as needed)
- `README.md`

---

## Implementation Documentation Template

Create `docs/implementations/async-ai-processing-rabbitmq.md` with the following structure:

```markdown
# Async AI Processing with RabbitMQ - Implementation Log

## Overview
[Brief description of the feature]

## Implementation Progress

### Section 1: Infrastructure Setup
**Status**: ✅ Complete / ⏸️ In Progress / ❌ Blocked

**Completed**:
- [List what was implemented]

**Files Created**:
- [List files]

**Files Modified**:
- [List files]

**Issues Encountered**:
- [List any issues]

**Test Results**:
- `npm run type-check:ci`: ✅ Pass / ❌ Fail
- `npm run test`: ✅ Pass / ❌ Fail

**Notes**:
- [Any additional notes]

### Section 2: AI Service - RabbitMQ Client
[Same structure for each section]

## Summary
[Final summary when all sections are complete]
```



## Key Design Decisions

1. **Always Async**: Tasks service always uses async pattern for create task
2. **Callback URL**: Built from `TASKS_SERVICE_BASE_URL` environment variable
3. **Token Reservation**: Tokens reserved before queueing (existing middleware)
4. **Token Reconciliation**: Actual tokens reconciled in Tasks service webhook endpoint (existing middleware)
5. **Metrics Exclusion**: 202 responses excluded from metrics (async requests are queued, not completed)
6. **Webhook Metrics**: Webhooks are NOT tracked separately (internal callbacks, not separate operations)
7. **Worker in Same Process**: Runs in same process as AI service (MVP)
8. **Webhook is Tasks Service**: The webhook endpoint (`/api/v1/webhooks`) is part of the Tasks service
9. **Webhook Error Handlers**: Webhook router includes `tasksErrorHandler` and `tokenUsageErrorHandler` for proper error handling
10. **Request ID Propagation**: Worker passes original `requestId` in webhook call headers for distributed tracing
11. **Worker Error Handling**: Worker handles capability execution errors and sends proper error structure to webhook
12. **UserId in Webhook**: Webhook extracts `userId` from payload and sets in `res.locals.authenticationContext` (overrides authentication middleware hardcoded value)
13. **HTTP Client in Clients Directory**: Worker uses HTTP client in `clients/tasks.ts` following existing pattern
14. **Server Startup Pattern**: Worker started using `initializeServer` callbacks (startCallback)
15. **Retry Strategy**: Exponential backoff with jitter, max 3 retries, DLQ for permanent failures
16. **Graceful Shutdown**: Stop consumer, wait for in-flight jobs (10s timeout), close connections, exit

## Complete File List

### Files to Create

- `backend/services/ai/src/clients/rabbitmq.ts`
- `backend/services/ai/src/clients/tasks.ts`
- `backend/services/ai/src/constants/rabbitmq.ts`
- `backend/services/ai/src/mocks/rabbitmq-mock.ts`
- `backend/services/ai/src/types/job-payload.ts`
- `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/execute-async-pattern.ts`
- `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/index.ts`
- `backend/services/ai/src/workers/capability-worker.ts`
- `backend/services/ai/src/workers/capability-worker.test.ts`
- `backend/services/ai/src/workers/start-worker.ts`
- `backend/services/tasks/src/schemas/webhook-schemas.ts`
- `backend/services/tasks/src/controllers/webhook-controller/webhook-controller.ts`
- `backend/services/tasks/src/controllers/webhook-controller/index.ts`
- `backend/services/tasks/src/controllers/webhook-controller/webhook-controller.test.ts`
- `backend/services/tasks/src/routers/webhook-router.ts`
- `backend/services/tasks/src/types/webhook-controller-input.ts`
- `backend/services/tasks/src/types/webhook-controller-response.ts`
- `docs/implementations/async-ai-processing-rabbitmq.md`

### Files to Modify

- `docker-compose.yml`
- `docker-compose.dev.yml`
- `backend/services/ai/package.json`
- `backend/services/ai/.env.example`
- `backend/services/ai/src/config/env.ts` (add RABBITMQ_URL and TASKS_SERVICE_BASE_URL)
- `backend/services/ai/src/constants/index.ts`
- `backend/services/ai/src/capabilities/parse-task/parse-task-schemas.ts`
- `backend/services/ai/src/controllers/capabilities-controller/executors/get-pattern-executor/get-pattern-executor.ts`
- `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`
- `backend/services/ai/src/server.ts`
- `backend/services/tasks/.env.example`
- `backend/services/tasks/src/config/env.ts`
- `backend/services/tasks/src/types/ai-capability.ts`
- `backend/services/tasks/src/types/index.ts`