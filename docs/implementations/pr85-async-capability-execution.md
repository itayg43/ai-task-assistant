# Async Capability Execution with RabbitMQ Implementation

## Overview

This document summarizes the implementation of **Async Capability Execution with RabbitMQ**. This feature refactors the AI service to process capability execution requests asynchronously using RabbitMQ message queues, enabling better scalability, reliability, and separation of concerns. The implementation includes a background worker for processing messages, callback URL support for notifying the Tasks service of completion, and comprehensive error handling.

## Architecture Changes

### Core Concept

The async capability execution system implements a **message queue pattern** that:

1. **Accepts Requests**: AI service receives capability execution requests and immediately returns `202 Accepted`
2. **Queues Messages**: Requests are sent to RabbitMQ queue for background processing
3. **Processes Asynchronously**: Background worker consumes messages and executes capabilities
4. **Sends Callbacks**: Worker sends success/error callbacks to Tasks service via HTTP webhooks
5. **Handles Errors**: Comprehensive error handling with retry logic and proper message acknowledgment

### Key Components

1. **RabbitMQ Client**: Shared and service-specific clients for connection management and message operations
2. **Capabilities Controller**: Refactored to queue messages instead of executing synchronously
3. **Capabilities Worker**: Background worker that consumes messages and executes capabilities
4. **Webhooks Controller**: Handles callback URLs from AI service in Tasks service
5. **Tasks Client**: HTTP client in AI service for sending callbacks to Tasks service

## Implementation Details

### 1. RabbitMQ Infrastructure

#### 1.1 Shared RabbitMQ Client

**File**: `backend/shared/src/clients/rabbitmq/rabbitmq.ts`

Shared RabbitMQ client utilities:

- **`createRabbitMQConnection(url)`**: Establishes connection with retry logic using `DEFAULT_RETRY_CONFIG`
- **`closeRabbitMQConnection(connection)`**: Gracefully closes connection
- Includes connection error event handlers and logging

#### 1.2 AI Service RabbitMQ Client

**File**: `backend/services/ai/src/clients/rabbitmq/rabbitmq.ts`

Service-specific RabbitMQ client with global connection management:

- **`connectRabbitMQClient()`**: Initializes global connection on service startup
- **`closeRabbitMQClient()`**: Closes connection and channel on shutdown
- **`getRabbitMQConnection()`**: Returns global connection (throws if not initialized)
- **`getRabbitMQChannel(queue)`**: Creates/returns channel for specific queue
- **`sendMessageToRabbitMQQueue(queue, messageData)`**: Sends typed messages to queues

**Key Features**:

- Global connection and channel management (singleton pattern)
- Channel error and close event handlers
- Queue assertion (creates queue if not exists, marks as durable)
- Type-safe message sending using `QueueToMessageDataMap`
- Error handling with `ServiceUnavailableError` for send failures, `InternalError` for consumption failures

#### 1.3 Docker Compose Configuration

**File**: `docker-compose.yml`

Added RabbitMQ service with management UI (port 15672), persistent data volume, and environment-based credentials.

### 2. Capabilities Controller Refactoring

#### 2.1 Async Execution Pattern

**File**: `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`

**Before**: Synchronous execution - controller executed capability and returned result immediately

**After**: Async execution - controller queues message and returns `202 Accepted`

**Changes**:

- Removed synchronous execution logic
- Added RabbitMQ message queuing
- Returns `202 Accepted` status with acknowledgment message
- Extracts `callbackUrl` from validated query parameters

**Implementation**:

```typescript
export const executeCapability = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const requestId = res.locals.requestId;
    const config = getCapabilityConfig(res);
    const input = getCapabilityValidatedInput(res);
    const { callbackUrl } = getCapabilityValidatedQuery(res);

    await sendMessageToRabbitMQQueue(RABBITMQ_QUEUE.CAPABILITIES, {
      requestId,
      capability: config.name,
      input,
      callbackUrl,
    });

    res.status(StatusCodes.ACCEPTED).json({
      message: "The request has been received and will be executed shortly.",
      aiServiceRequestId: requestId,
    });
  } catch (error) {
    next(error);
  }
};
```

#### 2.2 Schema and Utility Changes

**File**: `backend/services/ai/src/schemas/execute-capability.ts`

Updated schema to require `callbackUrl` query parameter (validated as URL format).

**File**: `backend/services/ai/src/utils/get-capability-validated-query/get-capability-validated-query.ts`

Type-safe utility to retrieve validated query parameters from `res.locals.capabilityValidatedQuery`.

### 3. Capabilities Worker

#### 3.1 Worker Implementation

**File**: `backend/services/ai/src/workers/capabilities-worker/capabilities-worker.ts`

Background worker that consumes messages from RabbitMQ and executes capabilities:

**Key Functions**:

1. **`consumeCapabilitiesMessage()`**: Main entry point that sets up message consumption

   - Gets RabbitMQ channel for capabilities queue
   - Sets prefetch to 1 (process one message at a time)
   - Consumes messages with `noAck: false` (manual acknowledgment)
   - Handles consumption errors with `InternalError`

2. **`capabilitiesMessageHandler(channel, message)`**: Processes individual messages

   - Parses message data using schema validation
   - Validates capability configuration exists
   - Validates input using capability's input schema
   - Executes capability using `executeCapabilityHandler`
   - Sends success callback or error callback

3. **`executeCapabilityHandler(requestId, config, input)`**: Executes capability handler and validates output

   - Calls the capability's handler function with validated input
   - **Note**: Capability handlers (e.g., `executeParse`) include built-in retry logic using `withRetry(DEFAULT_RETRY_CONFIG)` for OpenAI API calls
   - Validates handler result against capability's output schema
   - Converts ZodError to InternalError with generic message to prevent leaking validation details
   - Returns validated output or rethrows errors

4. **`sendCallbackHandler(channel, message, requestId, callbackUrl, payload)`**: Unified callback handler

   - Accepts discriminated union payload: `{ success: true; result: unknown } | { success: false; error: ExtractedErrorInfo }`
   - Uses `withRetry` for HTTP callback resilience
   - Sends POST request to callback URL with payload (includes `aiServiceRequestId`)
   - Acknowledges message on success
   - Nacks message on failure (no requeue)
   - Logs appropriate error message based on payload type

5. **`parseMessageData(message)`**: Validates and parses message content
   - Parses JSON from message buffer
   - Validates using `capabilitiesQueueMessageDataSchema`
   - Returns null on parse/validation failure

**Message Acknowledgment Strategy**:

See Section 9 (Error Handling) for detailed acknowledgment and requeue policies. Summary:

- **Success/Error callbacks**: Message acknowledged after callback sent
- **Parse/Callback failures**: Message nacked without requeue

#### 3.2 Queue Message Schema

**File**: `backend/services/ai/src/schemas/capabilities-queue-message-data.ts`

Schema for validating RabbitMQ message payload:

```typescript
export const capabilitiesQueueMessageDataSchema = z.object({
  requestId: z.string(),
  capability: z.nativeEnum(CAPABILITY),
  input: z.unknown(),
  callbackUrl: z.string().url(),
});
```

**Type Export**: `backend/services/ai/src/types/capabilities-queue-message-data.ts`

#### 3.3 Worker Startup

**File**: `backend/services/ai/src/server.ts`

Worker is started during service initialization:

```typescript
await initializeServer(env.SERVICE_NAME, env.SERVICE_PORT, app, {
  startCallback: async () => {
    await connectRabbitMQClient();
    await consumeCapabilitiesMessage();
  },
  cleanupCallbacks: {
    afterSuccess: async () => {
      await closeRabbitMQClient();
    },
    afterFailure: async () => {
      await closeRabbitMQClient();
    },
  },
});
```

**Lifecycle**: Connects on startup, closes on shutdown or failure

### 4. Tasks Client

**File**: `backend/services/ai/src/clients/tasks.ts`

HTTP client for AI service to communicate with Tasks service:

```typescript
export const tasksClient = createHttpClient(
  "",
  `http://${env.SERVICE_NAME}:${env.SERVICE_PORT}`
);
```

**Usage**: Used by capabilities worker to send callbacks to Tasks service webhook endpoints

**Note**: Uses AI service's `SERVICE_NAME` and `SERVICE_PORT` to set the origin header when constructing the Tasks service URL.

### 5. Webhooks Controller

#### 5.1 Controller Implementation

**File**: `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.ts`

Handles callback URLs from AI service. Receives POST requests with success/error payloads, validates input, logs error details, and returns `200 OK` to acknowledge receipt.

**TODO Items** (noted in code): Sanitize error responses, handle token usage reconciliation, process successful task creation.

#### 5.2 Webhook Schema

**File**: `backend/services/tasks/src/schemas/webhooks-schemas.ts`

Discriminated union schema: Success payload (`success: true`, `result: { openaiMetadata, result: ParsedTask }`, `aiServiceRequestId`) or Error payload (`success: false`, `error: { status, message, context }`, `aiServiceRequestId`).

#### 5.3 Webhook Router

**File**: `backend/services/tasks/src/routers/webhooks-router.ts`

Route: `POST /api/v1/webhooks/create-task` with schema validation, controller handler, and domain error handler.

### 6. Type System Changes

**Files**:

- `backend/services/ai/src/types/queue-to-message-data-map.ts`: Type-safe mapping between queues and message data
- `backend/services/ai/src/types/rabbitmq-queue.ts`: Type-safe queue name references
- `backend/services/ai/src/types/express.d.ts`: Added `capabilityValidatedQuery` to Express locals for type-safe storage of validated query parameters

### 7. Removed Code

#### 7.1 Pattern-Based Execution

**Removed Files**:

- `backend/services/ai/src/controllers/capabilities-controller/executors/get-pattern-executor/`
- `backend/services/ai/src/utils/get-capability-pattern/`
- `backend/services/ai/src/constants/capability-pattern.ts`
- `backend/services/ai/src/types/capability-pattern.ts`

**Rationale**: Pattern-based execution (sync/async pattern selection) was removed in favor of always-async execution via RabbitMQ

#### 7.2 Metrics Middleware

**Removed Files**:

- `backend/services/ai/src/middlewares/metrics-middleware/`

**Rationale**: Metrics middleware was removed (metrics are now recorded directly in OpenAI client)

#### 7.3 Execution Pattern Refactoring

**Removed Files**:

- `backend/services/ai/src/controllers/capabilities-controller/executors/execute-sync-pattern/`

**Rationale**: The `executeSyncPattern` function was inlined into the capabilities worker as `executeCapabilityHandler` to:

- Remove misleading abstraction (no longer using pattern-based execution)
- Simplify codebase by eliminating unnecessary indirection
- Keep execution logic co-located with message handling logic

#### 7.4 Callback Handler Refactoring

**Refactoring**: Merged `sendSuccessCallbackHandler` and `sendErrorCallbackHandler` into a unified `sendCallbackHandler` function (see Section 3.1 for implementation details).

**Benefits**:

- Uses discriminated union type for payload: `{ success: true; result: unknown } | { success: false; error: ExtractedErrorInfo }`
- Reduces code duplication (~60 lines to ~35 lines)
- Single source of truth for callback logic
- Easier to maintain and extend

### 8. Configuration Changes

**Environment Variables** (`backend/services/ai/src/config/env.ts`): Added `RABBITMQ_URL` configuration.

**Constants**:

- `backend/services/ai/src/constants/rabbitmq-queue.ts`: Added `RABBITMQ_QUEUE.CAPABILITIES` constant
- `backend/services/ai/src/constants/error-types.ts`: Added `RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED` and `RABBITMQ_CONSUME_MESSAGE_FAILED` error types

### 9. Error Handling

**RabbitMQ Errors**:

- Send failures: `ServiceUnavailableError` with `RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED` type
- Consumption failures: `InternalError` with `RABBITMQ_CONSUME_MESSAGE_FAILED` type (stops worker)

**Worker Error Handling**:

- Parse/validation failures: Message nacked without requeue
- Execution errors: Error callback sent (if `callbackUrl` present), message acknowledged
- Execution errors (no `callbackUrl`): Message acknowledged, no callback sent
- Callback failures: Message nacked without requeue (after retries exhausted)

**Retry Strategy**:

The system implements **selective retries** at two levels to handle transient failures efficiently:

1. **OpenAI API Retries**: Capability handlers use `withRetry(DEFAULT_RETRY_CONFIG)` around OpenAI API calls (see `executeParse` in `openai.ts`). This handles transient API failures, rate limits, and network issues during capability execution.

2. **Callback HTTP Retries**: The `sendCallbackHandler` uses `withRetry(DEFAULT_RETRY_CONFIG)` around HTTP POST requests to the Tasks service callback URL. This handles transient network failures when delivering results.

**Retry Configuration**: Both retry layers use `DEFAULT_RETRY_CONFIG` with:

- Maximum attempts: 3
- Base delay: 1000ms
- Exponential backoff multiplier: 2 (delays: 1s, 2s, 4s)

**Why Selective Retries Over Message Requeue**:

Selective retries are superior to requeuing entire messages because:

- **Cost Efficiency**: If OpenAI succeeds but callback fails, requeuing would re-execute the expensive OpenAI call unnecessarily, wasting tokens and money
- **Performance**: Only the failed operation is retried, not the entire message processing flow
- **Idempotency**: Prevents duplicate work and potential side effects from re-executing successful operations
- **Clear Failure Boundaries**: Each layer (OpenAI, callback) handles its own retries independently

**No Message Requeue Policy**:

Messages are **never requeued** (nacked with `requeue: false`) because:

- Retries are already built into both the OpenAI API layer and callback HTTP layer
- Requeuing would restart the entire message processing flow, potentially re-executing successful operations (e.g., successful OpenAI calls)
- This would create inefficient loops: requeue → re-execute successful operations → retry → requeue again
- Failed messages after all retries are exhausted represent persistent failures (bugs, invalid data, or downstream service outages) that require manual intervention, not automatic retries

### 10. Testing

**RabbitMQ Client Tests**:

- `backend/shared/src/clients/rabbitmq/rabbitmq.test.ts`: Connection creation, error handling, closing
- `backend/services/ai/src/clients/rabbitmq/rabbitmq.test.ts`: Connection management, channel creation, message sending, error handling

**Capabilities Worker Tests** (`backend/services/ai/src/workers/capabilities-worker/capabilities-worker.test.ts`): Message consumption, parsing, validation, execution, callbacks, acknowledgment strategies, retry logic

**Mocks**:

- `backend/services/ai/src/mocks/rabbitmq-mocks.ts`: Mock connection, channel, and message objects
- `backend/services/ai/src/mocks/callbackUrl-mocks.ts`: Mock callback URLs

### 11. Integration Flow

#### 11.1 Request Flow

1. **Client Request**: Tasks service calls AI service capability endpoint

   ```
   POST /api/v1/capabilities/parse-task?callbackUrl=http://tasks:3001/api/v1/webhooks/create-task
   ```

2. **AI Service Controller**: Queues message and returns `202 Accepted`

   ```json
   {
     "message": "The request has been received and will be executed shortly.",
     "aiServiceRequestId": "..."
   }
   ```

3. **Message Queue**: Message stored in RabbitMQ `capabilities` queue

4. **Worker Processing**: Background worker consumes message

   - Validates message data
   - Executes capability using `executeCapabilityHandler` (validates handler output)
   - Sends callback to Tasks service using `sendCallbackHandler`

5. **Callback**: Tasks service receives webhook
   ```
   POST /api/v1/webhooks/create-task
   {
     "success": true,
     "result": { ... },
     "aiServiceRequestId": "..."
   }
   ```

#### 11.2 Error Flow

1. **Execution Error**: Capability execution fails

   - OpenAI API retries exhausted (if applicable)
   - Worker catches error
   - Extracts error info using `extractErrorInfo`
   - If `callbackUrl` is present: Sends error callback to Tasks service, then acknowledges message
   - If `callbackUrl` is missing: Message acknowledged without callback (edge case)

2. **Callback Failure**: HTTP callback fails

   - Retry logic attempts callback multiple times (see Section 9 for retry configuration)
   - If all retries fail, message is nacked (see Section 9 for no requeue policy)
   - Error logged for monitoring

3. **Parse Error**: Message cannot be parsed
   - Message nacked without requeue (see Section 9 for policy details)
   - Error logged
   - No callback sent (message is malformed)

## Benefits

- **Scalability**: Async processing enables horizontal scaling and queue buffering for traffic spikes
- **Reliability**: Message durability, selective retry logic at both OpenAI API and callback HTTP layers, and comprehensive error handling
- **Cost Efficiency**: Selective retries prevent re-executing expensive operations (e.g., successful OpenAI calls)
- **Separation of Concerns**: HTTP layer handles requests/responses, worker handles execution, callbacks handle notifications
- **Observability**: Request IDs tracked through entire flow with comprehensive logging

## Future Enhancements

- **Webhook Controller**: Complete task creation from callbacks, token usage reconciliation, error sanitization
- **Monitoring**: RabbitMQ metrics (queue depth, message rates), worker metrics (processing time, error rates), callback metrics
- **Resilience**: Dead letter queue, message TTL, circuit breaker for callbacks

## Related PRs

- **PR #84**: Tasks Error Handling (webhook error handling integration)
- **PR #82**: Tasks Service Metrics (metrics for webhook processing)
- **PR #65**: Token Usage Rate Limiter (token reconciliation in callbacks)
