# Async AI Processing with RabbitMQ Implementation

## Overview

This document summarizes the implementation of **Async AI Processing with RabbitMQ**. The implementation adds async AI processing capability alongside the existing sync pattern. When `pattern=async` is used with a `callbackUrl`, requests are published to RabbitMQ and return immediately with 202 Accepted. Workers process messages from the queue and send results to the callback URL.

## Architecture Alignment

This implementation follows project conventions for:
- Schema-first type inference (types inferred from Zod schemas)
- Discriminated unions for conditional type narrowing
- Client pattern (similar to Redis and Prisma clients)
- Retry logic using `withRetry` wrapper
- Single source of truth (schema defines both validation and types)

---

## Section 1: Infrastructure Setup

### Overview

This section adds RabbitMQ service to Docker Compose and installs required dependencies.

### Changes Made

#### 1. Docker Compose Configuration

**Files Modified**:
- `docker-compose.yml`
- `docker-compose.dev.yml` (Note: RabbitMQ service not added here as it's already in docker-compose.yml)

**Changes**:
- Added `rabbitmq` service using `rabbitmq:3-management` image
- Exposed ports:
  - `5672`: AMQP protocol port
  - `15672`: Management UI port
- Configured environment variables:
  - `RABBITMQ_DEFAULT_USER`: From root `.env` file
  - `RABBITMQ_DEFAULT_PASS`: From root `.env` file
- Added persistent volume: `rabbitmq_data:/var/lib/rabbitmq`
- Set restart policy: `unless-stopped`

**Service Configuration**:
```yaml
rabbitmq:
  image: rabbitmq:3-management
  ports:
    - "5672:5672"
    - "15672:15672"
  environment:
    RABBITMQ_DEFAULT_USER: ${RABBITMQ_DEFAULT_USER}
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_DEFAULT_PASSWORD}
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
  restart: unless-stopped
```

#### 2. Dependencies

**File Modified**: `backend/shared/package.json`

**Changes**:
- Added `amqplib: ^0.10.4` to `dependencies`
- Added `@types/amqplib: ^0.10.4` to `devDependencies`

**Rationale**:
- `amqplib` is the official Node.js client for RabbitMQ
- `@types/amqplib` provides TypeScript type definitions
- Dependencies are added to `backend/shared` since RabbitMQ client will be shared across services

### Verification

- ✅ Type checking passes
- ✅ All changes pass linting

### Notes

- RabbitMQ management UI will be available at `http://localhost:15672` after starting services
- Environment variables `RABBITMQ_DEFAULT_USER` and `RABBITMQ_DEFAULT_PASSWORD` must be added to root `.env` file
- The `rabbitmq_data` volume ensures message persistence across container restarts

---

## Section 2: RabbitMQ Client & Configuration

### Overview

This section creates the RabbitMQ client with connection management and adds environment configuration.

### Changes Made

#### 1. RabbitMQ Client

**Files Created**:
- `backend/shared/src/clients/rabbitmq/rabbitmq.ts`
- `backend/shared/src/clients/rabbitmq/index.ts`

**Functions Implemented**:

1. **`createRabbitMQConnection(url: string)`**
   - Creates a connection to RabbitMQ with retry logic for startup
   - Uses `withRetry` wrapper with `DEFAULT_RETRY_CONFIG` to handle connection failures
   - Sets up error event handler for runtime connection errors
   - Returns the connection object (`amqp.ChannelModel`)

2. **`closeRabbitMQConnection(connection: amqp.ChannelModel)`**
   - Closes the RabbitMQ connection gracefully
   - Includes error handling and logging
   - Throws error if close operation fails

**Implementation Details**:
- Uses `amqplib` library for RabbitMQ communication
- Follows the same pattern as Prisma client (using `withRetry` for connection)
- Type-safe implementation using explicit `amqplib` types (`amqp.ChannelModel`)
- Comprehensive error handling and logging
- Client is in `backend/shared` for reuse across services
- **Focused on connection management only** - channel creation and queue operations are handled in service layer

#### 2. Environment Configuration

**File Modified**: `backend/services/ai/src/config/env.ts`

**Changes**:
- Added `RABBITMQ_URL: url()` - RabbitMQ connection URL (validated as URL format)

**Environment Variables**:
```typescript
RABBITMQ_URL: string      // e.g., "amqp://user:password@localhost:5672"
```

**Note**: 
- The `RABBITMQ_URL` environment variable must be added to the AI service's `.env.dev` and `.env.test` files
- The URL should be constructed from the `RABBITMQ_DEFAULT_USER` and `RABBITMQ_DEFAULT_PASSWORD` environment variables used in docker-compose
- `RABBITMQ_QUEUE_NAME` will be defined as a constant (not an environment variable)

### Verification

- ✅ Run `npm run type-check:ci` from root - all types pass
- ✅ No linter errors

### Notes

- The RabbitMQ client uses explicit `amqplib` types (`amqp.ChannelModel`) for clarity
- Connection retry logic ensures the service can start even if RabbitMQ is not immediately available
- The client is focused on connection management (create/close) - channel and queue operations are handled in the service layer
- Services can use the connection directly: `const channel = await connection.createChannel()`
- The client is designed to be reusable across services (placed in `backend/shared`)

---

## Section 3: Type Definitions & Schema Updates

### Overview

This section updates Express types to add `capabilityValidatedQuery` with a discriminated union for sync/async patterns, and updates the schema to use a discriminated union.

### Changes Made

#### 1. Express Types Update

**File Modified**: `backend/services/ai/src/types/express.d.ts`

**Changes**:
- Removed `capabilityPattern?: CapabilityPattern` (no longer needed)
- Added `capabilityValidatedQuery` with discriminated union type inferred from schema
- Type is automatically inferred from `executeCapabilityInputSchema` query field

**Updated Interface**:
```typescript
interface Locals {
  capabilityConfig?: AnyCapabilityConfig;
  capabilityValidatedInput?: ...;
  capabilityValidatedQuery?: z.infer<
    typeof executeCapabilityInputSchema
  >["query"];
  requestId: string;
}
```

**Discriminated Union Type**:
The `capabilityValidatedQuery` type is a discriminated union:
- If `pattern` is `"async"`: `{ pattern: "async", callbackUrl: string }`
- If `pattern` is `"sync"`: `{ pattern: "sync" }`

This provides type safety - when pattern is async, TypeScript knows `callbackUrl` exists.

#### 2. Schema Update

**File Modified**: `backend/services/ai/src/schemas/execute-capability.ts`

**Changes**:
- Updated query schema to use `z.discriminatedUnion("pattern", [...])`
- Validates that async pattern includes `callbackUrl` (must be valid URL)
- Validates that sync pattern only includes `pattern`

**Schema Definition**:
```typescript
query: z.discriminatedUnion(
  "pattern",
  [
    z.object({
      pattern: z.literal(CAPABILITY_PATTERN.ASYNC),
      callbackUrl: z.string().url(),
    }),
    z.object({
      pattern: z.literal(CAPABILITY_PATTERN.SYNC),
    }),
  ],
  {
    message: "Invalid",
  }
)
```

#### 3. Middleware Update

**File Modified**: `backend/services/ai/src/middlewares/validate-executable-capability/validate-executable-capability.ts`

**Changes**:
- Removed setting of `capabilityPattern` in `res.locals`
- Now sets `capabilityValidatedQuery` with the validated query from schema
- The validated query is directly assigned (no type assertions needed)

#### 4. Utility Refactor

**File Refactored**: `backend/services/ai/src/utils/get-capability-validated-query/get-capability-validated-query.ts`

**Changes**:
- Refactored from `getCapabilityPattern` to `getCapabilityValidatedQuery`
- Returns the full validated query object (discriminated union) instead of just the pattern
- Allows access to `callbackUrl` for async pattern (type-safe via discriminated union)
- Updated controller to extract pattern from `validatedQuery.pattern`

### Verification

- ✅ Run `npm run type-check:ci` from root - all types pass
- ✅ No linter errors
- ✅ `validate-executable-capability.test.ts` - Updated to test discriminated union
- ✅ `get-capability-validated-query.test.ts` - Tests for getCapabilityValidatedQuery utility
- ✅ `capabilities-controller.unit.test.ts` - Updated to use getCapabilityValidatedQuery
- ✅ All tests pass with new type structure

### Notes

- **Type Inference**: `capabilityValidatedQuery` type is inferred directly from the schema using `z.infer<typeof executeCapabilityInputSchema>["query"]`, ensuring types always match the schema
- **Discriminated Union**: The discriminated union provides type narrowing - when pattern is "async", TypeScript knows `callbackUrl` exists
- **Schema Validation**: The schema validates that async pattern includes a valid URL for `callbackUrl`
- **Single Source of Truth**: Types are derived from schemas, eliminating duplication and ensuring consistency
- **Utility Refactor**: Refactored `getCapabilityPattern` to `getCapabilityValidatedQuery` - returns full query object instead of just pattern, enabling access to `callbackUrl` for async pattern
- **Controller Update**: Controller now uses `getCapabilityValidatedQuery` and extracts pattern from `validatedQuery.pattern`

---

---

## Section 4: Async Pattern Executor

### Overview

This section creates the async executor that publishes messages to RabbitMQ and updates the controller to handle async pattern requests.

### Changes Made

#### 1. AI Service RabbitMQ Client

**Files Created**:
- `backend/services/ai/src/clients/rabbitmq/rabbitmq.ts`
- `backend/services/ai/src/clients/rabbitmq/index.ts`

**Functions Implemented**:

1. **`connectRabbitMQClient()`**
   - Connects to RabbitMQ using shared client
   - Stores connection globally for reuse

2. **`closeRabbitMQClient()`**
   - Closes channel and connection gracefully
   - Handles cleanup on shutdown

3. **`getRabbitMQConnection()`**
   - Returns global connection
   - Throws error if not initialized

4. **`getRabbitMQChannel(queue: RabbitMQQueue)`**
   - Creates channel if not exists
   - Asserts queue with `durable: true`
   - Returns channel for operations

5. **`sendMessageToRabbitMQQueue<TQueue>(queue, messageData)`**
   - Type-safe message publishing using `QueueToMessageDataMap`
   - Sends message with `persistent: true`
   - Validates message data matches queue type

**Implementation Details**:
- Wraps shared RabbitMQ client for service-specific operations
- Provides type-safe queue operations using discriminated union mapping
- Manages channel lifecycle (single channel per service instance)
- Queue assertion ensures queue exists with correct configuration

#### 2. Queue Message Data Schema

**Files Created**:
- `backend/services/ai/src/schemas/capabilities-queue-message-data.ts`
- `backend/services/ai/src/types/capabilities-queue-message-data.ts`
- `backend/services/ai/src/types/rabbitmq-queue.ts`
- `backend/services/ai/src/types/queue-to-message-data-map.ts`
- `backend/services/ai/src/constants/rabbitmq-queue.ts`

**Schema Definition**:
```typescript
export const capabilitiesQueueMessageDataSchema = z.object({
  requestId: z.string(),
  capability: z.nativeEnum(CAPABILITY),
  input: z.unknown(),
  callbackUrl: z.string().url(),
});
```

**Type Mapping**:
- `QueueToMessageDataMap` provides type-safe mapping between queues and their message data types
- Enables compile-time validation of message data structure

#### 3. Async Executor

**Files Created**:
- `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/execute-async-pattern.ts`
- `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/index.ts`
- `backend/services/ai/src/controllers/capabilities-controller/executors/execute-async-pattern/execute-async-pattern.test.ts`

**Function Implementation**:
- Accepts `requestId`, `config`, `input`, and `callbackUrl` as parameters
- Uses `sendMessageToRabbitMQQueue` to publish message
- Returns `{ message: "The request has been received and will be executed shortly." }`
- Handles errors with `InternalError` and appropriate error type

**Error Handling**:
- Catches RabbitMQ publish errors
- Logs error with context (requestId, capability)
- Throws `InternalError` with `RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED` type

#### 4. Controller Update

**File Modified**: `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`

**Changes**:
- Uses `getCapabilityValidatedQuery` to get validated query
- Extracts pattern from `validatedQuery.pattern` (discriminated union ensures type safety)
- Directly calls `executeSyncPattern` or `executeAsyncPattern` based on pattern (no get-pattern-executor utility)
- Returns 202 Accepted for async pattern, 200 OK for sync pattern
- Includes `aiServiceRequestId` in response

**Note**: The `get-pattern-executor` utility was removed - the controller directly handles pattern selection for simplicity.

#### 5. Server Integration

**File Modified**: `backend/services/ai/src/server.ts`

**Changes**:
- Calls `connectRabbitMQClient()` in `startCallback`
- Calls `closeRabbitMQClient()` in cleanup callbacks (both success and failure)
- Ensures RabbitMQ connection is established before API starts accepting requests

**Note**: Worker service not yet implemented - server only connects to RabbitMQ for message publishing.

### Verification

- ✅ Run `npm run type-check:ci` from root - all types pass
- ✅ `execute-async-pattern.test.ts` - Tests for async executor
- ✅ `capabilities-controller.unit.test.ts` - Updated to test async pattern (202 status)
- ✅ All tests pass

### Notes

- **Type Safety**: `QueueToMessageDataMap` ensures compile-time validation of message data structure
- **Error Handling**: Async executor properly handles RabbitMQ publish failures with appropriate error types
- **Controller Simplification**: Removed `get-pattern-executor` utility - controller directly handles pattern selection
- **Message Schema**: Queue message data schema defined separately (not inline in worker) for reuse and type safety
- **Server Integration**: RabbitMQ connection established on startup, but worker not yet started

---

## Section 4.5: RabbitMQ Client Tests

### Overview

This section adds comprehensive unit tests for both the shared RabbitMQ client and the AI service RabbitMQ client wrapper.

### Changes Made

#### 1. Shared RabbitMQ Client Tests

**Files Created**:
- `backend/shared/src/clients/rabbitmq/rabbitmq.test.ts`

**Tests Implemented**:

1. **`createRabbitMQConnection` tests**:
   - Should create connection with retry logic (verifies `withRetry` is called with `DEFAULT_RETRY_CONFIG`)
   - Should set up error event handler on connection
   - Should use withRetry for connection retry logic (simulates retry on failure)
   - Should propagate connection errors through withRetry

2. **`closeRabbitMQConnection` tests**:
   - Should close connection gracefully
   - Should throw error if close operation fails

**Implementation Details**:
- Uses `vi.mock()` for `amqplib` and `withRetry`
- Uses `vi.hoisted()` for mock functions that need to be referenced in other mocks
- Tests both success and error paths
- Verifies retry logic integration

#### 2. AI Service RabbitMQ Client Tests

**Files Created**:
- `backend/services/ai/src/clients/rabbitmq/rabbitmq.test.ts`

**Tests Implemented**:

1. **`connectRabbitMQClient` tests**:
   - Should create RabbitMQ connection (verifies shared client is called with correct URL)
   - Should store connection globally (verifies connection can be retrieved)

2. **`closeRabbitMQClient` tests**:
   - Should close channel and connection (when both exist)
   - Should close connection even when channel is not created
   - Should handle case when connection is not initialized

3. **`getRabbitMQConnection` tests**:
   - Should return connection when initialized
   - Should throw error when connection is not initialized

4. **`getRabbitMQChannel` tests**:
   - Should create channel and assert queue (with `durable: true`)
   - Should reuse existing channel on subsequent calls
   - Should assert queue with durable option
   - Should throw error when connection is not initialized

5. **`sendMessageToRabbitMQQueue` tests**:
   - Should send message to queue with correct payload
   - Should use persistent message properties
   - Should serialize message data to JSON buffer
   - Should throw error when connection is not initialized

**Implementation Details**:
- Uses `vi.mock()` for shared RabbitMQ client and env config
- Uses `vi.hoisted()` for mock functions
- Properly handles global state cleanup in `afterEach`
- Tests channel lifecycle management
- Verifies type-safe message publishing

### Verification

- ✅ Run `npm run type-check:ci` from root - all types pass
- ✅ All tests follow project testing standards
- ✅ Tests use proper mocking patterns (`vi.mock()`, `vi.hoisted()`)
- ✅ Tests include proper cleanup in `afterEach`
- ✅ Tests cover both success and error paths

### Notes

- **Test Isolation**: Global state is properly cleaned up between tests using `closeRabbitMQClient()` in `afterEach`
- **Mock Patterns**: Follows project standards with `vi.hoisted()` for mocks referenced in other mocks
- **Coverage**: Tests cover all public functions and error scenarios
- **Type Safety**: Tests verify type-safe operations using `QueueToMessageDataMap`

---

## Next Steps

After approval, proceed to **Section 5: Worker Service** which will:
- Create worker that consumes messages from RabbitMQ
- Execute capabilities using `executeSyncPattern`
- Send results to callback URL
- Handle errors and acknowledgments

---

## Implementation Status

- ✅ **Section 1: Infrastructure Setup** - Completed
- ✅ **Section 2: RabbitMQ Client & Configuration** - Completed
- ✅ **Section 3: Type Definitions & Schema Updates** - Completed (includes utility refactor to `getCapabilityValidatedQuery`)
- ✅ **Section 4: Async Pattern Executor** - Completed (includes AI service client, message schema, and server integration)
- ✅ **Section 4.5: RabbitMQ Client Tests** - Completed (includes tests for shared and AI service clients)
- ⏳ **Section 5: Worker Service** - Pending
- ⏳ **Section 6: Server Integration (Worker)** - Pending
- ⏳ **Section 7: Testing (Worker)** - Pending

---

## Implementation Deviations from Plan

The following deviations from the original plan were made during implementation:

### 1. AI Service RabbitMQ Client

**Plan**: Channel and queue operations handled directly in executors using shared client connection.

**Actual**: Created `backend/services/ai/src/clients/rabbitmq/rabbitmq.ts` that wraps the shared client and provides:
- Channel management (single channel per service instance)
- Queue assertion with proper configuration
- Type-safe message publishing using `QueueToMessageDataMap`

**Rationale**: Centralizes queue operations, provides type safety, and simplifies executor code.

### 2. Message Data Schema

**Plan**: Message schema defined inline in worker using Zod.

**Actual**: Created separate schema file `capabilities-queue-message-data.ts` with:
- Zod schema for validation
- Type inference from schema
- Queue-to-message-data mapping type

**Rationale**: Enables type-safe message publishing in executor, allows schema reuse, and provides compile-time validation.

### 3. Pattern Executor Utility

**Plan**: Create `get-pattern-executor` utility that returns appropriate executor function.

**Actual**: Removed utility - controller directly calls `executeSyncPattern` or `executeAsyncPattern` based on pattern.

**Rationale**: Simplifies code structure, reduces indirection, and makes pattern handling more explicit.

### 4. Queue Constants and Types

**Plan**: Queue name as constant, types inferred from usage.

**Actual**: Created:
- `constants/rabbitmq-queue.ts` - Queue name constants
- `types/rabbitmq-queue.ts` - Queue type
- `types/queue-to-message-data-map.ts` - Type mapping for type-safe operations

**Rationale**: Provides better type safety and enables compile-time validation of queue operations.
