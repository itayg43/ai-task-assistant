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

#### 4. Utility Update

**File Modified**: `backend/services/ai/src/utils/get-capability-pattern/get-capability-pattern.ts`

**Changes**:
- Updated to read pattern from `res.locals.capabilityValidatedQuery` instead of `capabilityPattern`
- Accesses the discriminated union directly
- Type-safe access to pattern field

### Verification

- ✅ Run `npm run type-check:ci` from root - all types pass
- ✅ No linter errors
- ✅ `validate-executable-capability.test.ts` - Updated to test discriminated union
- ✅ `get-capability-pattern.test.ts` - Updated to use `capabilityValidatedQuery`
- ✅ All tests pass with new type structure

### Notes

- **Type Inference**: `capabilityValidatedQuery` type is inferred directly from the schema using `z.infer<typeof executeCapabilityInputSchema>["query"]`, ensuring types always match the schema
- **Discriminated Union**: The discriminated union provides type narrowing - when pattern is "async", TypeScript knows `callbackUrl` exists
- **Schema Validation**: The schema validates that async pattern includes a valid URL for `callbackUrl`
- **Single Source of Truth**: Types are derived from schemas, eliminating duplication and ensuring consistency
- **Removed Redundancy**: Removed `capabilityPattern` field since pattern is now accessible via `capabilityValidatedQuery.pattern`

---

## Next Steps

After approval, proceed to **Section 4: Async Pattern Executor** which will:
- Create async executor that publishes messages to RabbitMQ
- Update pattern executor to handle async case
- Update controller to return 202 for async pattern

---

## Implementation Status

- ✅ **Section 1: Infrastructure Setup** - Completed
- ✅ **Section 2: RabbitMQ Client & Configuration** - Completed
- ✅ **Section 3: Type Definitions & Schema Updates** - Completed
- ⏳ **Section 4: Async Pattern Executor** - Pending
- ⏳ **Section 5: Worker Service** - Pending
- ⏳ **Section 6: Server Integration** - Pending
- ⏳ **Section 7: Testing** - Pending
