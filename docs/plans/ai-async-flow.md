# Async AI Processing with RabbitMQ MVP

## Overview

This plan implements async AI processing using RabbitMQ. The flow: (1) Client → Tasks (input validation), (2) Tasks → AI Service, (3) AI Service validates (prompt injection, schema), (4) AI Service creates job in RabbitMQ, (5) AI Service returns 202 to Tasks, (6) Tasks returns 202 to client, (7) Worker processes job, calls OpenAI, then calls Tasks service webhook endpoint, (8) Tasks service webhook creates task and reconciles token usage. Token usage is reserved before queueing and reconciled in webhook callback.

## Important Instructions for Agent

**CRITICAL WORKFLOW**:

0. **BEFORE STARTING SECTION 1** (MANDATORY FIRST STEP):

- **CREATE** the implementation doc at `docs/implementations/async-ai-processing-rabbitmq.md`
- Use the template provided at the end of this plan (see "Implementation Documentation Template" section)
- Initialize it with the overview and structure for all 10 sections
- This doc MUST be created before starting any implementation work

1. **Before starting each major section**: **WAIT FOR USER APPROVAL** before proceeding to the next section
2. **After completing each major section**:

- **MANDATORY VALIDATION STEPS** (must pass before requesting approval):

1.  Run `npm run type-check:ci` to verify TypeScript compilation

                - If it fails: Fix all TypeScript errors and run again
                - **DO NOT proceed until type-check passes**

2.  Run `npm run test` to verify all tests pass

                - If tests fail: Fix all failing tests and run again
                - **DO NOT proceed until all tests pass**

3.  Repeat steps 1-2 until BOTH `npm run type-check:ci` AND `npm run test` pass successfully

- **MANDATORY: Update the implementation doc** at `docs/implementations/async-ai-processing-rabbitmq.md`: - **MUST be updated after EACH section completion** (not optional) - Document what was implemented in this section - List all files created/modified - Document any issues encountered - Record test results (must show ✅ Pass for both type-check and tests) - Update the section status (✅ Complete / ⏸️ In Progress / ❌ Blocked)
- **WAIT FOR USER APPROVAL**: After validation passes and doc is updated, request approval from user
- **DO NOT proceed to next section until user explicitly approves the current section**

3. **If errors occur during validation**:

- Fix the errors and re-run validation
- Document any issues in the implementation doc
- If unable to fix after reasonable attempts, document the issue and wait for user guidance
- **DO NOT proceed to next section until current section is fully validated and approved**

**TYPE DEFINITION PATTERN** (CRITICAL):

- **ALL new types MUST be defined in the `types/` folder** as separate files (e.g., `types/job-payload.ts`, `types/webhook-controller-input.ts`)
- **ALL new types MUST be exported from `types/index.ts`** using barrel export pattern
- This ensures types are accessible via `@types` path alias (e.g., `import { TCapabilityJobPayload } from "@types"`)
- When creating new type files, always update the corresponding `types/index.ts` to export them
- Follow existing patterns: domain types use `T` prefix (e.g., `TCapabilityJobPayload`), DTOs have no prefix (e.g., `WebhookCallbackInput`)

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

**For MVP/POC**: Implement basic graceful shutdown (no active job tracking):

- Stop consumer on signal (cancels subscription, prevents new jobs)
- Wait 5-10 seconds for any in-flight jobs to complete (simple timeout, no tracking)
- Close connections (RabbitMQ will requeue unacknowledged messages)
- Exit process
- Note: For POC, we don't track active jobs. The 5-10 second wait gives in-flight jobs time to complete.

Unacknowledged messages will be requeued by RabbitMQ automatically.

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

8. Update `backend/services/ai/tsconfig.json`:

- Add `"@workers/*": ["src/workers/*"] `to the `paths` object in `compilerOptions`
- This enables path alias imports for worker files (e.g., `@workers/start-worker`)

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
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
- `backend/services/ai/tsconfig.json` (add `@workers/*` path alias)

---

### Section 2: AI Service - RabbitMQ Client ⏸️ REQUIRES APPROVAL

**Scope**: RabbitMQ client implementation and mocks**RabbitMQ Fundamentals (for first-time users)**:Before implementing, understand these key concepts:

1. **Connection vs Channel**:

- **Connection**: A TCP connection to RabbitMQ server. Expensive to create, shared across operations.
- **Channel**: A lightweight virtual connection within a connection. All operations (publish, consume) happen on channels.
- One connection can have multiple channels. Channels are cheap to create.

2. **Queues**:

- A queue is a buffer that stores messages. Think of it like a mailbox.
- Messages are published (sent) to queues and consumed (received) from queues.
- **Durable queue**: Survives broker restarts. Non-durable queues are deleted on restart.
- **Queue assertion**: Creates queue if it doesn't exist, or verifies it exists if it does.

3. **Messages**:

- Messages are binary data (we use JSON strings converted to Buffer).
- **Persistent message**: Written to disk, survives broker restart. Non-persistent messages are lost on restart.
- Messages stay in queue until consumed and acknowledged.

4. **Publishing (Sending Messages)**:

- Publisher sends message to a queue.
- Message is stored in queue until a consumer picks it up.
- `sendToQueue()` directly sends to a queue (simpler than exchanges for our use case).

5. **Consuming (Receiving Messages)**:

- Consumer subscribes to a queue and receives messages.
- RabbitMQ delivers messages to consumers.
- Multiple consumers can consume from same queue (load balancing).

6. **Acknowledgment (Ack/Nack)**:

- **Ack (acknowledge)**: Consumer tells RabbitMQ "I processed this successfully, delete it."
- **Nack (negative acknowledge)**: Consumer tells RabbitMQ "I failed, handle it."
- **noAck=false**: Consumer must manually ack/nack. If not acked, message stays in queue.
- **noAck=true**: RabbitMQ auto-acks on delivery (not recommended - can lose messages if consumer crashes).

7. **Prefetch**:

- Limits how many unacknowledged messages a consumer can have.
- Prefetch=1: "Give me one message, wait for ack, then give next."
- Ensures fair distribution among multiple workers.
- Without prefetch, one worker might grab all messages.

8. **Requeue**:

- When nacking with requeue=true, RabbitMQ puts message back in queue for retry.
- When nacking with requeue=false, RabbitMQ discards message (permanent failure).

9. **Dead Letter Queue (DLQ)**:

- A special queue for messages that couldn't be processed after retries.
- Allows manual inspection and potential replay of failed jobs.

10. **Connection Management**:

                - Connections can fail (network issues, broker restart).
                - amqp-connection-manager automatically reconnects.
                - Channels don't survive connection failures - must be recreated.
                - This is why we use `addSetup()` - ensures setup runs after reconnection.

**Message Flow Example**:

```javascript
1. Publisher: publishJob() → sends message to queue
2. Queue: Message stored (waiting for consumer)
3. Consumer: createConsumer() → receives message from queue
4. Handler: processJob() → processes message
5a. Success: channel.ack() → RabbitMQ deletes message from queue
5b. Failure: channel.nack(requeue=true) → RabbitMQ puts message back in queue
5c. Permanent failure: channel.nack(requeue=false) → RabbitMQ discards or sends to DLQ
```

**Tasks**:

1. Add RabbitMQ dependencies to `backend/services/ai/package.json`:

- `"amqp-connection-manager": "^4.1.14"`
- `"amqplib": "^0.10.4"`
- `"@types/amqplib": "^0.10.4"` to devDependencies

2. Run `npm install` in `backend/services/ai`
3. Create `backend/services/ai/src/clients/rabbitmq.ts`:

- Import `connect` from `amqp-connection-manager` and `amqplib` from `amqplib`
- Import `env` from `@config/env`
- Import `RABBITMQ_QUEUE_NAME, RABBITMQ_DLQ_NAME` from `@constants`
- Import `createLogger` from `@shared/config/create-logger`
-
- **RabbitMQ Concepts (for comments)**:
- **Connection**: A TCP connection to RabbitMQ server. One connection can have multiple channels.
- **Channel**: A virtual connection within a connection. All operations (publish, consume) happen on channels.
- **Queue**: A buffer that stores messages. Messages are published to queues and consumed from queues.
- **Durable**: A durable queue survives broker restarts. Non-durable queues are deleted on restart.
- **Persistent**: A persistent message is written to disk. Non-persistent messages are lost on broker restart.
- **Acknowledgment (ack)**: Consumer tells RabbitMQ "I processed this message successfully, you can delete it."
- **Negative Acknowledgment (nack)**: Consumer tells RabbitMQ "I failed to process this, handle it" (requeue or discard).
- **Prefetch**: Limits how many unacknowledged messages a consumer can have. Prefetch=1 means "give me one message, wait for ack, then give next."
- **Dead Letter Queue (DLQ)**: A queue for messages that couldn't be processed after retries.
- **Requeue**: When a message is nacked with requeue=true, RabbitMQ puts it back in the queue for retry.
- **noAck**: If false, consumer must manually acknowledge messages. If true, RabbitMQ auto-acks on delivery.

- Create connection using `connect([env.RABBITMQ_URL])`:
- amqp-connection-manager expects an array of URLs (for failover support)
- This creates a connection manager that automatically reconnects on connection loss
- Add comment: "Connection manager handles automatic reconnection - if RabbitMQ goes down and comes back,

the connection will be restored automatically without manual intervention"

- Use `connection.createChannel()` wrapper which returns a channel wrapper with automatic reconnection:
- Add comment: "Channel wrapper automatically recreates channels if connection is lost and restored.

This is important because channels don't survive connection failures."

- Export `publishJob(queueName: string, jobData: unknown): Promise<void>`:
- Add detailed comments explaining each step:

  ```typescript
  /**
   * Publishes a job to a RabbitMQ queue.
   *
   * @param queueName - The name of the queue to publish to
   * @param jobData - The job payload to serialize and send
   *
   * Flow:
   * 1. Get or create a channel (channel wrapper handles reconnection)
   * 2. Assert the queue exists (creates it if it doesn't, with durable=true so it survives restarts)
   * 3. Serialize jobData to JSON and convert to Buffer (RabbitMQ messages are binary)
   * 4. Send message to queue with persistent=true (message written to disk, survives broker restart)
   * 5. Wait for confirmation (optional - can add publisher confirms later for better reliability)
   */
  ```

- Use `connection.createChannel()` to get channel wrapper
- Use `channel.addSetup()` or direct channel access (channel wrapper provides channel as first arg to callbacks)
- Assert queue: `channel.assertQueue(queueName, { durable: true })` - Add comment: "Assert queue creates it if it doesn't exist. durable=true means queue survives broker restarts."
- Publish message: `channel.sendToQueue(queueName, Buffer.from(JSON.stringify(jobData)), { persistent: true })` - Add comment: "persistent=true writes message to disk. If broker restarts, message is not lost.

Buffer.from() converts JSON string to binary format that RabbitMQ expects."

- Note: For better reliability, consider implementing publisher confirms (wait for confirmation) - Add comment: "Publisher confirms ensure message was received by broker. For POC, we skip this for simplicity,

but it's recommended for production to guarantee message delivery."

- Handle errors and log appropriately
- Use structured logging with requestId if available

- Export `createConsumer(queueName: string, handler: (msg: unknown) => Promise<void>): Promise<void>`:
- Add detailed comments explaining consumer pattern:

  ```typescript
  /**
   * Creates a consumer that processes messages from a RabbitMQ queue.
   *
   * @param queueName - The name of the queue to consume from
   * @param handler - Async function that processes each message
   *
   * Consumer Flow:
   * 1. Set up channel and queue (runs on initial connection and after reconnection)
   * 2. Set prefetch to 1 (fair distribution - process one message at a time)
   * 3. Start consuming messages (RabbitMQ delivers messages one by one)
   * 4. For each message:
   *    a. Parse JSON payload
   *    b. Call handler function
   *    c. If handler succeeds: ack message (tell RabbitMQ to delete it)
   *    d. If handler fails: nack message (tell RabbitMQ to requeue or discard)
   *
   * Message Acknowledgment:
   * - noAck=false means we must manually acknowledge messages
   * - If we ack: RabbitMQ deletes message from queue (job completed)
   * - If we nack with requeue=true: RabbitMQ puts message back in queue (retry)
   * - If we nack with requeue=false: RabbitMQ discards message (permanent failure)
   * - If we crash without acking: RabbitMQ requeues message (ensures no message loss)
   */
  ```

- Use `connection.createChannel()` to get channel wrapper
- Use `channel.addSetup()` to set up consumer (ensures setup runs after reconnection) - Add comment: "addSetup ensures consumer is recreated if connection is lost and restored.

This is critical - without this, consumer stops working after reconnection."

- Assert queue: `channel.assertQueue(queueName, { durable: true })` - Add comment: "Ensure queue exists before consuming. If queue doesn't exist, create it as durable."
- Set prefetch: `channel.prefetch(1)` - Add comment: "Prefetch=1 means 'give me one message, wait for ack, then give next message'.

This ensures fair distribution among multiple workers. Without prefetch, one worker might

grab all messages while others sit idle."

- Consume messages: `channel.consume(queueName, async (msg) => { ... }, { noAck: false })` - Add comment: "noAck=false means we must manually acknowledge each message.

If we don't ack, message stays in queue and will be redelivered."

- For each message: - Check if message is null (channel closed) - Add comment: "If msg is null, channel was closed. This can happen during shutdown or reconnection." - Parse JSON: `JSON.parse(msg.content.toString())` - Add comment: "RabbitMQ messages are Buffers. Convert to string, then parse JSON." - Call handler with parsed message data - Handler should return Promise that resolves on success, rejects on failure - After handler resolves: Acknowledge message `channel.ack(msg)` - Add comment: "Ack tells RabbitMQ 'I processed this successfully, you can delete it from the queue'.

Message is removed from queue and won't be redelivered."

                - After handler rejects: Reject message based on error type:
                - Permanent failures (4xx, validation errors): `channel.nack(msg, false, false)`
                                - Add comment: "nack(msg, false, false) = 'discard this message, don't requeue'.

false, false means: don't requeue to all consumers, don't requeue at all.

Use for permanent failures that won't succeed on retry (e.g., validation errors)."

                - Transient failures (5xx, network errors): `channel.nack(msg, false, true)`
                                - Add comment: "nack(msg, false, true) = 'put this message back in queue for retry'.

false, true means: don't requeue to all consumers, but do requeue to this queue.

Use for transient failures that might succeed on retry (e.g., temporary network issues)."

                - Handle errors and log appropriately
                - Add comment: "Wrap in try-catch. If handler throws unexpected error, nack with requeue=true

so message can be retried (might be transient issue)."

- Note: For POC, we acknowledge after handler completes successfully.

If handler fails, message is rejected and may be requeued by RabbitMQ.

                - Add comment: "This pattern ensures no message loss. If worker crashes mid-processing,

unacknowledged message is automatically requeued by RabbitMQ."

- Export `publishToDLQ(queueName: string, jobData: unknown, error: Error): Promise<void>`:
- Add detailed comments:

  ```typescript
  /**
   * Publishes a failed job to the Dead Letter Queue (DLQ).
   *
   * DLQ is used for messages that couldn't be processed after all retries.
   * This allows manual inspection and potential replay of failed jobs.
   *
   * @param queueName - The DLQ queue name
   * @param jobData - The original job payload
   * @param error - The error that caused the failure
   */
  ```

- Use same channel wrapper pattern
- Assert DLQ queue: `channel.assertQueue(queueName, { durable: true })` - Add comment: "DLQ should be durable so failed jobs aren't lost on broker restart."
- Publish failed job with error details: Include jobData and error information in message - Add comment: "Include both original job data and error details so we can:

                1. Understand why it failed (error message, stack trace)
                2. Replay the job if needed (original jobData)"

- Use for permanent failures after retries - Add comment: "Only send to DLQ after all retries exhausted. Transient failures should be requeued,

not sent to DLQ immediately."

- Handle connection errors and reconnections (amqp-connection-manager handles this automatically)
- Add comment: "amqp-connection-manager automatically:

                1. Detects connection loss
                2. Attempts reconnection with exponential backoff
                3. Recreates channels after reconnection
                4. Emits events we can listen to (connect, disconnect, error)"

- Use structured logging following project patterns
- Note: Channel wrapper from amqp-connection-manager automatically recreates channels on reconnection
- Add comment: "This is why we use channel.addSetup() - setup code runs every time channel is created,

including after reconnection. Without this, consumer would stop working after reconnection."

- Implementation note: Verify exact API for amqp-connection-manager during implementation:
- `connection.createChannel()` returns a channel wrapper
- Use `channel.addSetup((channel) => { ... })` for setup that runs after reconnection
- Or use `channel.waitForConnect()` and then access channel directly
- Refer to amqp-connection-manager documentation for exact patterns
- Add comment: "Check amqp-connection-manager README for exact API. The wrapper pattern might vary

between versions. Key is ensuring setup runs after reconnection."

4. Create `backend/services/ai/src/mocks/rabbitmq-mock.ts`:

- Export mock functions for `publishJob`, `createConsumer`, and `publishToDLQ`
- Use `vi.fn()` for testing
- Follow mock file naming pattern

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
- Document RabbitMQ client implementation
- Document connection management approach (amqp-connection-manager automatic reconnection)
- Document channel wrapper usage and addSetup pattern
- Document prefetch count setting (1 for fair distribution)
- Document message acknowledgment patterns
- Document mock implementation
- Document DLQ support
- Note: Publisher confirms can be added later for enhanced reliability (optional for POC)

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
    capability: Capability; // Capability name (e.g., "parse-task"), not the full config
    // Note: We store the capability name instead of CapabilityConfig because:
    // - CapabilityConfig contains functions (handler) and Zod schemas that cannot be serialized to JSON
    // - The worker will look up the config from the capabilities registry using this name
    // - This differs from sync flow which uses res.locals.capabilityConfig (already validated by middleware)
    input: unknown; // Full validated input structure (params, query, body) matching what executeSyncPattern expects
    // Note: This is the complete validated input, not just the body, so it can be passed directly to executeSyncPattern
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
- **IMPORTANT**: Always export new types from `types/index.ts` to make them accessible via `@types` path alias

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
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

- Add optional fields for async pattern: - `callbackUrl?: z.string().url()` - `userId?: z.number().int().positive()` - `tokenReservation?: z.object({ tokensReserved: z.number(), windowStartTimestamp: z.number() })`
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
- Store `capability` name from `input.params.capability` (not the full config - see comment in job-payload.ts)
- Store full `input` (validated input with params, query, body) - this matches what executeSyncPattern expects
- Store `callbackUrl`, `userId`, `tokenReservation`, `requestId`
- Add comment explaining why we store capability name instead of config (functions can't be serialized)
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

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
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
- Note: For POC, we do NOT track active jobs. RabbitMQ will automatically requeue unacknowledged messages.
- Implement retry logic helper: - `retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number): Promise<T>` - Exponential backoff: `min(1000 * Math.pow(2, attempt), 30000) + Math.random() * 1000` - Retry on transient errors, throw on permanent errors
- Implement `processJob(jobPayload: TCapabilityJobPayload): Promise<void>`: - Extract capability name, input, callbackUrl, requestId, userId, tokenReservation from payload - Get capability config from capabilities registry: - Look up `capabilities[capability]` (same pattern as validateExecutableCapability middleware) - Add comment explaining: "Unlike sync flow which uses res.locals.capabilityConfig (already validated by middleware),

we look up from registry here because CapabilityConfig contains functions that cannot be serialized to RabbitMQ.

The capability name was stored in the job payload, and we reconstruct the config here."

                - Throw error if capability not found (should not happen if validation was correct, but handle gracefully)
                - Try-catch for capability execution:
                - Execute capability handler using `executeSyncPattern` (reuse sync logic)
                - Create discriminated union for job processing result (for better type inference):
     ```typescript
          type TJobProcessingResult =
            | { status: "success"; result: CapabilityResponse<...>; openaiMetadata: ... }
            | { status: "failure"; error: { message: string; type?: string } };
     ```

                - On success: Create success payload matching webhook discriminated union:
                                - `status: "success"`
                                - `result: TParsedTask` (from execution result)
                                - `openaiMetadata`, `aiServiceRequestId`, `userId`, `naturalLanguage`, `tokenReservation`
                - On failure: Create failure payload matching webhook discriminated union:
                                - `status: "failure"`
                                - `error: { message: string, type?: string }` (extract from error object)
                                - `aiServiceRequestId`, `userId`, `naturalLanguage`, `openaiMetadata` (if available), `tokenReservation`
                - POST to callbackUrl using `tasksClient.post()` with retry:
                                - URL: `/api/v1/webhooks`
                                - Headers: `{ "x-request-id": requestId }`
                                - Body: success or failure payload (discriminated union)
                                - Retry on transient failures (5xx, network errors)
                                - Don't retry on 4xx (permanent failures)
                - Handle errors: Log and publish to DLQ after max retries
                - Note: Message acknowledgment is handled by createConsumer wrapper:
                - If processJob resolves successfully: message is acknowledged
                - If processJob rejects: message is rejected (requeue based on error type)
                - This ensures job is not lost if webhook fails - message will be requeued
                - Use structured logging with requestId

- Implement `startWorker(): Promise<void>`: - Set up graceful shutdown handlers: - `process.on('SIGTERM', handleShutdown)` - `process.on('SIGINT', handleShutdown)` - `handleShutdown` function: - Log "Shutting down worker gracefully" - Stop consumer (cancel subscription - prevents new jobs from being consumed) - Wait 5-10 seconds for any in-flight jobs to complete (simple timeout, no active tracking) - Close RabbitMQ connection - Note: Unacknowledged messages will be automatically requeued by RabbitMQ - Log "Worker shutdown complete" - Exit process - Start consuming from queue using `createConsumer(RABBITMQ_QUEUE_NAME, processJob)` - Log worker startup - Note: For POC, we don't track active jobs. If shutdown occurs during job processing,

the message will be requeued when connection closes (if not yet acknowledged)

5. Create `backend/services/ai/src/workers/start-worker.ts`:

- Import `startWorker` from `./capability-worker`
- Import `createLogger` from `@shared/config/create-logger`
- Export `initializeWorker(): Promise<void>`: - Log "Starting capability worker" - Call `startWorker()` - Handle errors: If worker startup fails (e.g., RabbitMQ connection fails), throw error - This will cause AI service startup to fail (fail fast approach) - Log error: "Worker failed to start, AI service startup aborted" - Let the error propagate to initializeServer, which will call afterFailure cleanup

6. Update `backend/services/ai/src/server.ts`:

- Import `initializeWorker` from `@workers/start-worker`
- Update `initializeServer` call to include `startCallback`: - Call `initializeWorker()` in startCallback - Follow existing pattern from tasks service server.ts

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

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
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
- Note: This will be a discriminated union type with `status` as discriminator, providing better type inference
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
- Define webhook callback schema using discriminated union for better type inference: - Use `z.discriminatedUnion` with `status` as discriminator:

  ```typescript
       const webhookCallbackBodySchema = z.discriminatedUnion("status", [
         z.object({
           status: z.literal("success"),
           aiServiceRequestId: z.string(),
           userId: z.number().int().positive(),
           naturalLanguage: z.string(),
           result: TParsedTask, // Required when status is "success"
           openaiMetadata: z.record(z.string(), z.object({ ... })), // TOpenaiMetadata structure
           tokenReservation: z.object({ tokensReserved: z.number(), windowStartTimestamp: z.number() }).optional(),
         }),
         z.object({
           status: z.literal("failure"),
           aiServiceRequestId: z.string(),
           userId: z.number().int().positive(),
           naturalLanguage: z.string(),
           error: z.object({ message: z.string(), type: z.string().optional() }), // Required when status is "failure"
           openaiMetadata: z.record(z.string(), z.object({ ... })).optional(), // Optional for failures
           tokenReservation: z.object({ tokensReserved: z.number(), windowStartTimestamp: z.number() }).optional(),
         }),
       ]);
  ```

                - Wrap in body schema: `webhookCallbackSchema = z.object({ body: webhookCallbackBodySchema })`
                - This provides better type inference: TypeScript will narrow the type based on `status` field
                - Follow schema definition pattern from project conventions

4. Update `backend/services/tasks/src/types/index.ts`:

- Export `WebhookCallbackInput` from `./webhook-controller-input`
- Export `WebhookCallbackResponse` from `./webhook-controller-response`
- Follow barrel export pattern
- **IMPORTANT**: Always export new types from `types/index.ts` to make them accessible via `@types` path alias

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
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
- Implement `handleWebhookCallback`: - Extract `requestId` from `res.locals` - Extract validated body from request (will be set by validateSchema middleware) - Extract `userId`, `naturalLanguage`, `result`, `openaiMetadata`, `status`, `error`, `tokenReservation` - **Set authentication context**: `res.locals.authenticationContext = { userId }` (override hardcoded value from authentication middleware) - Set `res.locals.tokenUsage` with: - `tokensReserved`: from tokenReservation (if provided) - `windowStartTimestamp`: from tokenReservation (if provided) - `actualTokens`: extracted from openaiMetadata using `extractOpenaiTokenUsage` - Log "Handle webhook callback - starting" with baseLogContext - If status is "success": - TypeScript will narrow type based on discriminated union - `result` field is guaranteed to exist - Create task in database using transaction: - Call `createTask` with userId, naturalLanguage, result (from narrowed type) - If result.subtasks exists, call `createManySubtasks` - Call `findTaskById` to get task with subtasks - Log "Handle webhook callback - succeeded" - Return 201 Created with task data: `{ tasksServiceRequestId: requestId, task: taskToResponseDto(task) }` - If status is "failure": - TypeScript will narrow type based on discriminated union - `error` field is guaranteed to exist - Log error details (from narrowed `error` field) - Set `actualTokens: 0` in `res.locals.tokenUsage` (release reserved tokens - no actual usage) - Return 201 Created with error acknowledgment (webhook was received and processed) - Call `next()` to continue to post-response middleware (token usage reconciliation) - Note: Token reconciliation will release reserved tokens since actualTokens is 0 - Handle errors: pass to error handler via `next(error)`
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
- Add route: `webhookRouter.post("/", [validateSchema(webhookCallbackSchema)], handleWebhookCallback, openaiUpdateTokenUsage)`
- Note: `openaiUpdateTokenUsage` is post-response middleware (placed after controller, not in array)
- Follow router pattern from tasks-router.ts (see line 18-22 for reference)
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

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
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
    | {
        capability: TCapability;
        pattern: "sync";
        params: TAiCapabilityMap[TCapability]["params"];
      }
    | {
        capability: TCapability;
        pattern: "async";
        params: TAiCapabilityMap[TCapability]["params"] & {
          callbackUrl: string;
          userId: number;
          tokenReservation?: {
            tokensReserved: number;
            windowStartTimestamp: number;
          };
        };
      };
  ```

- Use union type pattern with `pattern` as discriminator

2. Update `backend/services/tasks/src/services/tasks-service/tasks-service.ts`:

- Import `env` from `@config/env`
- Update `createTaskHandler` signature to accept `tokenUsage` parameter: - `createTaskHandler(requestId: string, userId: number, naturalLanguage: string, tokenUsage?: { tokensReserved: number; windowStartTimestamp: number })`
- Update `createTaskHandler` to: - Always use async pattern (remove sync logic or keep as fallback) - Extract `userId` from parameters - Construct `callbackUrl` from `env.TASKS_SERVICE_BASE_URL + "/api/v1/webhooks"` - Call `executeCapability` with: - `pattern: "async"` - `params: { naturalLanguage, config: DEFAULT_PARSE_TASK_CONFIG, callbackUrl, userId, tokenReservation: tokenUsage ? { tokensReserved: tokenUsage.tokensReserved, windowStartTimestamp: tokenUsage.windowStartTimestamp } : undefined }` - Handle response (discriminated union): - Check `response.status === "queued" && response.pattern === "async"` - TypeScript will narrow type - `response.data` will be `{ aiServiceRequestId: string }` - Return response (discriminated union type) - Remove database operations (moved to webhook) - Remove token usage extraction (moved to webhook)

3. Update `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`:

- Update `createTask` to: - Extract `tokenUsage` from `res.locals` (set by token usage rate limiter middleware) - Pass `tokenUsage` to `createTaskHandler` (if available) - Handle response from handler (discriminated union): - If `status === "queued"` and `pattern === "async"`: Return 202 with `{ tasksServiceRequestId: requestId }` - TypeScript will narrow the type based on discriminated union - Do NOT call `next()` for post-response middleware (token usage reconciliation happens in webhook) - Log: "Create task (async) - starting", "Create task (async) - succeeded"

4. Update `backend/services/tasks/src/services/ai-capabilities-service/ai-capabilities-service.ts`:

- Update `executeCapability` to handle async pattern using discriminated union return type: - Create discriminated union return type:

  ```typescript
  type TExecuteCapabilityResult<TResult> =
    | {
        status: "success";
        pattern: "sync";
        data: TAiCapabilityResponse<TResult>;
      }
    | {
        status: "queued";
        pattern: "async";
        data: { aiServiceRequestId: string };
      };
  ```

                - Update function signature: `Promise<TExecuteCapabilityResult<TCapabilityResult>>`
                - Use type guard: `if (config.pattern === "async")` to narrow config type
                - Include `callbackUrl`, `userId`, and `tokenReservation` in request body when async
                - Include `requestId` in headers (`x-request-id`)
                - Handle 202 Accepted response: return `{ status: "queued", pattern: "async", data: { aiServiceRequestId: string } }`
                - Handle 200 OK response: return `{ status: "success", pattern: "sync", data: response }`
                - This provides better type inference: TypeScript will narrow based on `status` and `pattern` fields

- Update error handling to distinguish between 202 (expected) and other status codes

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
- Document async flow implementation
- Document callback URL construction
- Document token reservation passing
- Document 202 response handling
- Document type narrowing for async pattern

**Files to Create**:

- `backend/services/tasks/src/types/execute-capability-result.ts` (discriminated union for capability execution results)

**Files to Modify**:

- `backend/services/tasks/src/types/ai-capability.ts`
- `backend/services/tasks/src/services/tasks-service/tasks-service.ts`
- `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`
- `backend/services/tasks/src/services/ai-capabilities-service/ai-capabilities-service.ts`
- `backend/services/tasks/src/types/index.ts` (export new discriminated union type)

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

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
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

**Validation** (MANDATORY - must pass before requesting approval):

- Run `npm run type-check:ci` - **MUST pass** (fix all errors and re-run if needed)
- Run `npm run test` - **MUST pass** (fix all failing tests and re-run if needed)
- **Repeat both commands until BOTH pass successfully**
- **DO NOT proceed to next section until validation passes and user approves**
- Review documentation

**Implementation Doc Update** (MANDATORY):

- **MUST update** `docs/implementations/async-ai-processing-rabbitmq.md` after completing this section
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
16. **Graceful Shutdown**: Stop consumer, close connections immediately (no active job tracking for POC)
17. **Message Acknowledgment**: Acknowledge only after successful webhook callback (ensures job not lost)
18. **Token Reconciliation on Failure**: Set actualTokens to 0 to release reserved tokens
19. **Worker Startup Failure**: AI service fails to start if worker fails (fail fast approach)
20. **Discriminated Unions**: Use discriminated unions for webhook payloads, capability responses, and job results for better type inference

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
- `backend/services/tasks/src/types/execute-capability-result.ts`
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
- `backend/services/ai/tsconfig.json` (add `@workers/*` path alias in Section 1)
- `backend/services/tasks/.env.example`
- `backend/services/tasks/src/config/env.ts`
- `backend/services/tasks/src/types/ai-capability.ts`
