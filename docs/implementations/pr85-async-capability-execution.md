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

New utility for type-safe retrieval of validated query parameters from `res.locals.capabilityValidatedQuery` (set by `validateExecutableCapability` middleware).

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
   - Executes capability using `executeSyncPattern`
   - Sends success callback or error callback

3. **`sendSuccessCallbackHandler(channel, message, requestId, callbackUrl, result)`**: Sends success callback

   - Uses `withRetry` for HTTP callback resilience
   - Sends POST request to callback URL with success payload
   - Acknowledges message on success
   - Nacks message on failure (no requeue)

4. **`sendErrorCallbackHandler(channel, message, requestId, callbackUrl, errorInfo)`**: Sends error callback

   - Uses `withRetry` for HTTP callback resilience
   - Sends POST request to callback URL with error payload
   - Acknowledges message on success
   - Nacks message on failure (no requeue)

5. **`parseMessageData(message)`**: Validates and parses message content
   - Parses JSON from message buffer
   - Validates using `capabilitiesQueueMessageDataSchema`
   - Returns null on parse/validation failure

**Message Acknowledgment Strategy**:

- **Success/Error**: Message acknowledged after callback sent (success or error)
- **Parse/Callback Failure**: Message nacked without requeue (prevents infinite retries)

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

**Lifecycle**: Connects to RabbitMQ and starts consuming messages on service startup; closes connection on graceful shutdown or failure

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

**Note**: Currently uses AI service's own `SERVICE_NAME` and `SERVICE_PORT` environment variables to construct the Tasks service URL.

### 5. Webhooks Controller

#### 5.1 Controller Implementation

**File**: `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.ts`

Handles callback URLs from AI service. Currently receives POST requests with success/error payloads, validates input, logs error details, and returns `200 OK` to acknowledge receipt.

**TODO Items** (noted in code): Sanitize error responses, handle token usage reconciliation, process successful task creation.

#### 5.2 Webhook Schema

**File**: `backend/services/tasks/src/schemas/webhooks-schemas.ts`

Discriminated union schema for webhook payloads. Success payload includes `openaiMetadata`, `result` (ParsedTask), and `aiServiceRequestId`. Error payload includes `error` (with status, message, context) and `aiServiceRequestId`.

#### 5.3 Webhook Router

**File**: `backend/services/tasks/src/routers/webhooks-router.ts`

Route: `POST /api/v1/webhooks/create-task` with schema validation, controller handler, and domain error handler.

### 6. Type System Changes

#### 6.1 Type System Changes

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
- Execution errors: Error callback sent, message acknowledged
- Callback failures: Message nacked without requeue (after retries exhausted)

**Retry Strategy**: HTTP callbacks use `withRetry` with `DEFAULT_RETRY_CONFIG`. No automatic message requeue on processing errors (prevents infinite loops).

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
   - Executes capability using `executeSyncPattern`
   - Sends callback to Tasks service

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

   - Worker catches error
   - Extracts error info using `extractErrorInfo`
   - Sends error callback to Tasks service
   - Acknowledges message

2. **Callback Failure**: HTTP callback fails

   - Retry logic attempts callback multiple times
   - If all retries fail, message is nacked (no requeue)
   - Error logged for monitoring

3. **Parse Error**: Message cannot be parsed
   - Message nacked without requeue
   - Error logged

## Benefits

- **Scalability**: Async processing enables horizontal scaling and queue buffering for traffic spikes
- **Reliability**: Message durability, retry logic for callbacks, and comprehensive error handling
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
