---
name: Async AI Processing with RabbitMQ
overview: Implement async AI processing alongside existing sync capability using RabbitMQ. The async pattern accepts a callbackUrl in query params, publishes messages to RabbitMQ, returns 202 immediately, and workers process messages and call back with results.
todos:
  - id: docker-rabbitmq
    content: Add RabbitMQ service to docker-compose.yml and docker-compose.dev.yml with env vars from root .env
    status: pending
  - id: add-dependencies
    content: Add amqplib and @types/amqplib to backend/shared/package.json
    status: pending
  - id: rabbitmq-client
    content: Create RabbitMQ client with connection management in backend/shared (connection only, no channel/queue operations)
    status: pending
    dependencies:
      - add-dependencies
  - id: env-config
    content: Add RABBITMQ_URL to AI service env.ts (validated as URL)
    status: pending
  - id: update-schema
    content: Update execute-capability schema to discriminated union (sync vs async with callbackUrl)
    status: pending
  - id: update-middleware
    content: Update validate-executable-capability to store capabilityValidatedQuery in res.locals
    status: pending
    dependencies:
      - update-schema
      - express-types
  - id: async-executor
    content: Create execute-async-pattern that publishes messages to RabbitMQ and returns 202
    status: pending
    dependencies:
      - rabbitmq-client
      - update-middleware
  - id: update-pattern-executor
    content: Add async case to get-pattern-executor
    status: pending
    dependencies:
      - async-executor
  - id: update-controller
    content: Update capabilities-controller to return 202 for async pattern
    status: pending
    dependencies:
      - update-pattern-executor
  - id: worker-service
    content: Create capability-worker that consumes messages, uses executeSyncPattern for execution, and calls back. Define message and callback payload types inline using Zod.
    status: pending
    dependencies:
      - rabbitmq-client
  - id: update-server
    content: Update server.ts to start worker alongside API
    status: pending
    dependencies:
      - worker-service
  - id: express-types
    content: Add capabilityValidatedQuery to Express locals with discriminated union type (inferred from schema)
    status: pending
  - id: create-mocks
    content: Create RabbitMQ connection mock factory in backend/shared
    status: pending
    dependencies:
      - add-dependencies
  - id: update-existing-tests
    content: Update existing tests for async pattern support
    status: pending
    dependencies:
      - async-executor
      - update-middleware
  - id: async-executor-tests
    content: Create unit tests for execute-async-pattern
    status: pending
    dependencies:
      - async-executor
      - create-mocks
  - id: worker-tests
    content: Create unit tests for capability-worker
    status: pending
    dependencies:
      - worker-service
      - create-mocks
  - id: rabbitmq-client-tests
    content: Create unit tests for RabbitMQ client
    status: pending
    dependencies:
      - rabbitmq-client
      - create-mocks
  - id: verify-infrastructure
    content: Verify infrastructure: Run 'npm run test' and 'npm run type-check:ci' after docker-rabbitmq and add-dependencies
    status: pending
    dependencies:
      - docker-rabbitmq
      - add-dependencies
  - id: verify-rabbitmq-client
    content: Verify RabbitMQ client: Run 'npm run test' and 'npm run type-check:ci' after rabbitmq-client and rabbitmq-client-tests
    status: pending
    dependencies:
      - rabbitmq-client
      - rabbitmq-client-tests
  - id: verify-schema-middleware
    content: Verify schema and middleware: Run 'npm run test' and 'npm run type-check:ci' after update-schema, update-middleware, and update-existing-tests
    status: pending
    dependencies:
      - update-schema
      - update-middleware
      - update-existing-tests
  - id: verify-async-executor
    content: Verify async executor: Run 'npm run test' and 'npm run type-check:ci' after async-executor, update-pattern-executor, update-controller, and async-executor-tests
    status: pending
    dependencies:
      - async-executor
      - update-pattern-executor
      - update-controller
      - async-executor-tests
  - id: verify-worker
    content: Verify worker: Run 'npm run test' and 'npm run type-check:ci' after worker-service, update-server, and worker-tests
    status: pending
    dependencies:
      - worker-service
      - update-server
      - worker-tests
  - id: verify-final
    content: Final verification: Run 'npm run test' and 'npm run type-check:ci' to ensure all tests pass and types are correct
    status: pending
    dependencies:
      - verify-infrastructure
      - verify-rabbitmq-client
      - verify-schema-middleware
      - verify-async-executor
      - verify-worker
---

# Async AI Processing with RabbitMQ

## Overview

Implement async AI processing capability alongside the existing sync pattern. When `pattern=async` is used with a `callbackUrl`, requests are published to RabbitMQ and return immediately with 202 Accepted. Workers process messages from the queue and send results to the callback URL. Uses manual acknowledgment - only ack after successful callback delivery.

## Implementation Process

**Important**: After completing each section and running verification steps (`npm run test` and `npm run type-check:ci`), **wait for user approval before proceeding** to the next section. This ensures each phase is reviewed and approved before continuing.

## Architecture Flow

```mermaid
sequenceDiagram
    participant Client
    participant AIAPI as AI Service API
    participant RabbitMQ
    participant Worker
    participant OpenAI
    participant Callback as Callback URL

    Client->>AIAPI: POST /api/v1/capabilities/parse-task?pattern=async&callbackUrl=...
    AIAPI->>AIAPI: Validate input & prompt injection
    AIAPI->>RabbitMQ: Publish message (durable, persistent)
    AIAPI-->>Client: 202 Accepted { aiServiceRequestId, message }

    Worker->>RabbitMQ: Consume message (prefetch=1, noAck=false)
    Note over Worker,OpenAI: withRetry wrapper handles retries
    Worker->>OpenAI: Execute capability (with retries)
    OpenAI-->>Worker: Result
    Note over Worker,Callback: withRetry wrapper handles retries
    Worker->>Callback: POST payload (with retries)
    Callback-->>Worker: 200 OK
    Worker->>RabbitMQ: Ack message

    alt All retries exhausted - Callback still fails
        Note over Worker: No requeue: retries already handled by withRetry
        Worker->>RabbitMQ: Nack message (no requeue)
    end
```

## Implementation Steps

### 1. Infrastructure Setup

**Add RabbitMQ to Docker Compose**

- Add `rabbitmq` service to `docker-compose.yml` and `docker-compose.dev.yml`
- Use official `rabbitmq:3-management` image
- Expose ports 5672 (AMQP) and 15672 (management UI)
- Add volume for data persistence

**Add Dependencies**

- Add `amqplib` and `@types/amqplib` to `backend/shared/package.json`

**Verification Step**

- Run `npm run test` from root to ensure no test regressions
- Run `npm run type-check:ci` from root to ensure no type errors
- **Wait for user approval before proceeding to Section 2**

### 2. RabbitMQ Client & Configuration

**Create RabbitMQ Client** (`backend/shared/src/clients/rabbitmq/rabbitmq.ts`)

- Connection management with async/await (following amqplib async patterns)
- Connection retry logic for startup using `withRetry` wrapper
- Error event handling for runtime connection issues
- Export connection utilities only (channel and queue operations handled in service layer)

**Environment Configuration**

- Add `RABBITMQ_URL` to `backend/services/ai/src/config/env.ts` (validated as URL using `url()` validator)
- Reference `RABBITMQ_DEFAULT_USER` and `RABBITMQ_DEFAULT_PASSWORD` in `docker-compose.yml` for RabbitMQ service
- `RABBITMQ_QUEUE_NAME` will be defined as a constant (not an environment variable)

**Verification Step**

- Run `npm run test` from root to ensure RabbitMQ client tests pass
- Run `npm run type-check:ci` from root to ensure no type errors
- **Wait for user approval before proceeding to Section 3**

### 3. Type Definitions & Schema Updates

**Update Express Types** (`backend/services/ai/src/types/express.d.ts`)

- Remove `capabilityPattern?: CapabilityPattern` (no longer needed)
- Add `capabilityValidatedQuery` with discriminated union type inferred from schema:
  ```typescript
  capabilityValidatedQuery?: z.infer<
    typeof executeCapabilityInputSchema
  >["query"];
  ```
- Type is automatically inferred from schema, ensuring single source of truth

**Update Query Schema** (`backend/services/ai/src/schemas/execute-capability.ts`)

- Convert query to discriminated union using `z.discriminatedUnion("pattern", [...])`:
  - `sync` pattern: only `pattern` required
  - `async` pattern: both `pattern` and `callbackUrl` required (validated as URL)
- Schema validates `callbackUrl` is a valid URL for async pattern

**Update Middleware** (`backend/services/ai/src/middlewares/validate-executable-capability/validate-executable-capability.ts`)

- Remove setting of `capabilityPattern` in `res.locals`
- Store validated query in `res.locals.capabilityValidatedQuery`
- The validated query is directly assigned (no type assertions needed)

**Update Utility** (`backend/services/ai/src/utils/get-capability-pattern/get-capability-pattern.ts`)

- Update to read pattern from `res.locals.capabilityValidatedQuery` instead of `capabilityPattern`
- Type-safe access to pattern field from discriminated union

**Verification Step**

- Run `npm run test` from root to ensure schema and middleware tests pass
- Run `npm run type-check:ci` from root to ensure no type errors
- **Wait for user approval before proceeding to Section 5**

### 5. Async Pattern Executor

**Create Async Executor** (`backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/execute-async-pattern.ts`)

- Get `callbackUrl` from `res.locals.capabilityValidatedQuery` (discriminated union ensures it exists for async pattern)
- Create channel and assert queue in executor (not in shared client)
- Publish message to RabbitMQ queue with:
  - `requestId` (from res.locals)
  - `capability` name
  - `input` (validated input)
  - `callbackUrl` (from capabilityValidatedQuery)
- Message properties: `persistent: true`
- Return `{ aiServiceRequestId: requestId, message: "Request received and will be processed shortly" }`

**Update Pattern Executor** (`backend/services/ai/src/controllers/capabilities-controller/executors/get-pattern-executor/get-pattern-executor.ts`)

- Add async case returning `executeAsyncPattern`

**Update Controller** (`backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`)

- Return 202 Accepted for async pattern instead of 200 OK

**Verification Step**

- Run `npm run test` from root to ensure async executor and controller tests pass
- Run `npm run type-check:ci` from root to ensure no type errors
- **Wait for user approval before proceeding to Section 6**

### 6. Worker Service

**Create Worker** (`backend/services/ai/src/workers/capability-worker/capability-worker.ts`)

- Connect to RabbitMQ using shared client
- Create channel and assert queue (durable: true)
- Set `prefetch(1)` for fair dispatch
- Consume queue with `noAck: false` (manual acknowledgment)
- For each message:

  1. Parse message payload using Zod schema defined inline in worker:
     - Define message schema: `{ requestId: string, capability: Capability, input: unknown, callbackUrl: string }`
     - Validate and parse message content
  2. Get capability config from `capabilities` registry (import from `@capabilities`)
  3. Execute using `executeSyncPattern` (import from `@controllers/capabilities-controller/executors/execute-sync-pattern`, reuses existing executor logic with schema validation)
  4. Format callback payload using Zod schema defined inline:
     - Success schema: `{ success: z.literal(true), data: { openaiMetadata, result, aiServiceRequestId } }`
     - Error schema: `{ success: z.literal(false), error: { message: string, statusCode: number, context?: Record<string, unknown> } }`
  5. POST to callbackUrl with `withRetry` wrapper (using DEFAULT_RETRY_CONFIG from shared)
  6. On successful callback: `channel.ack(msg)`
  7. On callback failure: `channel.nack(msg, false, false)` (no requeue - retries already handled)

**Error Handling in Worker**

- Catch errors from `executeSyncPattern` execution
- Extract error context:
  - For vague input errors: extract `openaiMetadata` from error if available
  - For other errors: extract error message, statusCode, and any additional context
- Format error payload: `{ success: false, error: { message, statusCode, ...context } }`
- Always attempt callback delivery (even for errors) using `withRetry`
- Only ack after successful callback delivery
- On callback failure after all retries: nack without requeue (retries already handled at OpenAI and callback levels)

**Worker Entry Point** (`backend/services/ai/src/workers/capability-worker/index.ts`)

- Initialize worker and start consuming
- Handle graceful shutdown

### 7. Server Integration

**Update Server** (`backend/services/ai/src/server.ts`)

- Start worker alongside API server
- Handle graceful shutdown for both API and worker

**Verification Step**

- Run `npm run test` from root to ensure worker tests pass
- Run `npm run type-check:ci` from root to ensure no type errors
- **Wait for user approval before proceeding to Section 7**

### 8. Testing

**Update Existing Tests**

1. **`get-pattern-executor.test.ts`**

   - Update async pattern test: should return async executor function (not throw)
   - Remove the test that expects async to throw

2. **`capabilities-controller.unit.test.ts`**

   - Add test for async pattern: should return 202 Accepted with `{ aiServiceRequestId, message }`
   - Add test: should call async executor for async pattern
   - Update existing test to verify sync returns 200 OK

3. **`validate-executable-capability.test.ts`**
   - Test: should store capabilityValidatedQuery with sync pattern (only pattern field)
   - Test: should store capabilityValidatedQuery with async pattern (pattern and callbackUrl)
   - Test: should validate callbackUrl is a valid URL for async pattern
   - Test: should reject async pattern without callbackUrl

**Create New Unit Tests**

1. **`execute-async-pattern.test.ts`**

   - Test: should publish message to RabbitMQ with correct payload
   - Test: should use persistent message properties
   - Test: should return correct response format
   - Test: should handle RabbitMQ publish errors
   - Use `vi.mock()` for RabbitMQ client
   - Use mock factory from `@shared/mocks/rabbitmq-mock`

2. **`capability-worker.test.ts`**

   - Test: should consume messages from queue
   - Test: should create channel and assert queue (durable: true)
   - Test: should set prefetch(1)
   - Test: should parse message payload using inline Zod schema
   - Test: should use executeSyncPattern for execution
   - Test: should format success callback payload using inline Zod schema
   - Test: should format error callback payload with context using inline Zod schema
   - Test: should call callback URL with withRetry
   - Test: should ack message on successful callback
   - Test: should nack without requeue on callback failure after retries
   - Test: should handle capability execution errors
   - Test: should extract error context (openaiMetadata for vague input)
   - Use `vi.mock()` for RabbitMQ client, capabilities, executeSyncPattern, withRetry
   - Use mock factories and mock values

3. **`rabbitmq.test.ts`** (in shared)
   - Test: should create connection with correct URL
   - Test: should use withRetry for connection retry logic
   - Test: should handle connection errors
   - Test: should close connection gracefully
   - Use `vi.mock()` for amqplib

**Create Mock Files**

1. **`backend/shared/src/mocks/rabbitmq-mock.ts`**

   - Export `createRabbitMQConnectionMock()` - Returns mock connection (amqp.ChannelModel)
   - Follow pattern from other mock factories (logger-mock, redis-mock)
   - Note: Channel and message mocks can be created inline in tests as needed

**Test Structure Guidelines**

- Use `Mocked<T>` from `@shared/types` for typed mocks
- Use `vi.clearAllMocks()` in `afterEach` only when mocks are used
- Follow Arrange-Act-Assert pattern
- Use `expect.any(String)` for dynamic values (requestId)
- Use `expect.objectContaining()` for partial object matching
- Test both success and error paths
- Verify error messages don't leak sensitive data

**Final Verification Step**

- Run `npm run test` from root to ensure all tests pass
- Run `npm run type-check:ci` from root to ensure all types are correct
- Fix any failing tests or type errors before proceeding
- **Wait for user approval before considering implementation complete**

## Files to Create

1. `backend/shared/src/clients/rabbitmq/rabbitmq.ts` - RabbitMQ connection management (connection only)
2. `backend/shared/src/clients/rabbitmq/index.ts` - Export
3. `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/execute-async-pattern.ts` - Async executor (creates channel and asserts queue)
4. `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/index.ts` - Export
5. `backend/services/ai/src/workers/capability-worker/capability-worker.ts` - Worker logic (defines message and callback payload schemas inline)
6. `backend/services/ai/src/workers/capability-worker/index.ts` - Worker entry point
7. `backend/shared/src/mocks/rabbitmq-mock.ts` - RabbitMQ connection mock factory
8. `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/execute-async-pattern.test.ts` - Unit tests for async executor
9. `backend/services/ai/src/workers/capability-worker/capability-worker.test.ts` - Unit tests for worker
10. `backend/shared/src/clients/rabbitmq/rabbitmq.test.ts` - Unit tests for RabbitMQ client

## Files to Modify

1. `docker-compose.yml` - Add RabbitMQ service with env vars from root .env
2. `backend/shared/package.json` - Add amqplib and @types/amqplib dependencies
3. `backend/services/ai/src/config/env.ts` - Add RABBITMQ_URL validation (url() validator)
4. `backend/services/ai/src/types/express.d.ts` - Add capabilityValidatedQuery with discriminated union (inferred from schema), remove capabilityPattern
5. `backend/services/ai/src/schemas/execute-capability.ts` - Discriminated union for query params (sync vs async with callbackUrl)
6. `backend/services/ai/src/middlewares/validate-executable-capability/validate-executable-capability.ts` - Store capabilityValidatedQuery in res.locals
7. `backend/services/ai/src/utils/get-capability-pattern/get-capability-pattern.ts` - Read from capabilityValidatedQuery instead of capabilityPattern
8. `backend/services/ai/src/controllers/capabilities-controller/executors/get-pattern-executor/get-pattern-executor.ts` - Add async case
9. `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts` - Return 202 for async
10. `backend/services/ai/src/server.ts` - Start worker
11. `backend/services/ai/src/controllers/capabilities-controller/executors/get-pattern-executor/get-pattern-executor.test.ts` - Update to test async pattern
12. `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.unit.test.ts` - Add async pattern tests (202 status)
13. `backend/services/ai/src/middlewares/validate-executable-capability/validate-executable-capability.test.ts` - Update tests for capabilityValidatedQuery
14. `backend/services/ai/src/utils/get-capability-pattern/get-capability-pattern.test.ts` - Update tests for capabilityValidatedQuery

## Key Implementation Details

- **Queue Configuration**: Durable queue, persistent messages, prefetch=1
- **Acknowledgment**: Manual ack only after successful callback delivery
- **Error Handling**: Nack without requeue on callback failure (retries already handled at OpenAI and callback levels via withRetry)
- **No Redis**: Message state not stored, only in RabbitMQ messages
- **RequestId**: Reuse existing `requestId` from middleware, no messageId generation
- **Shared Client**: RabbitMQ connection management in `backend/shared` (channel and queue operations in service layer)
- **Environment**: Only `RABBITMQ_URL` in AI service env.ts (validated as URL), queue name as constant
- **Type Safety**: `capabilityValidatedQuery` uses discriminated union inferred from schema (single source of truth)
- **Schema-First**: Types inferred from Zod schemas, ensuring runtime validation matches TypeScript types
- **Inline Types**: Message and callback payload types defined inline in worker using Zod (not separate type files)
- **Verification**: Run `npm run test` and `npm run type-check:ci` after each major section to catch issues early
- **Approval Process**: Wait for user approval after completing each section and verification before proceeding to the next section
