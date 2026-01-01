# Async AI Processing with RabbitMQ - Implementation Log

## Overview

This document tracks the implementation of async AI processing using RabbitMQ. The flow enables asynchronous task processing: (1) Client → Tasks (input validation), (2) Tasks → AI Service, (3) AI Service validates (prompt injection, schema), (4) AI Service creates job in RabbitMQ, (5) AI Service returns 202 to Tasks, (6) Tasks returns 202 to client, (7) Worker processes job, calls OpenAI, then calls Tasks service webhook endpoint, (8) Tasks service webhook creates task and reconciles token usage. Token usage is reserved before queueing and reconciled in webhook callback.

## Implementation Progress

### Section 1: Infrastructure Setup

**Status**: ✅ Complete

**Completed**:

- Added RabbitMQ service to `docker-compose.yml` with ports 5672 (AMQP) and 15672 (management UI)
  - Uses environment variables `${RABBITMQ_DEFAULT_USER}` and `${RABBITMQ_DEFAULT_PASS}` for credentials
- Added `RABBITMQ_URL` environment variable to AI service config (using `str()` from envalid)
- Added `TASKS_SERVICE_BASE_URL` environment variable to AI service config (using `url()` from envalid for better validation)
- Added `SERVICE_URL` environment variable to Tasks service config (using `url()` from envalid) - Tasks service uses this to refer to itself
- Created `backend/services/ai/src/constants/rabbitmq.ts` with object-based constants:
  - `RABBITMQ_QUEUE.AI_CAPABILITY_JOBS` (instead of flat `RABBITMQ_QUEUE_NAME`)
  - `RABBITMQ_DLQ.AI_CAPABILITY_JOBS_DLQ` (instead of flat `RABBITMQ_DLQ_NAME`)
- Updated `backend/services/ai/src/constants/index.ts` to export RabbitMQ constants
- Updated `backend/services/ai/tsconfig.json` to add `@workers/*` path alias

**Files Created**:

- `backend/services/ai/src/constants/rabbitmq.ts`

**Files Modified**:

- `docker-compose.yml` (RabbitMQ service added with env vars for credentials)
- `backend/services/ai/src/config/env.ts` (added RABBITMQ_URL and TASKS_SERVICE_BASE_URL with url() validation)
- `backend/services/tasks/src/config/env.ts` (added SERVICE_URL - Tasks service uses this for its own URL)
- `backend/services/ai/src/constants/index.ts`
- `backend/services/ai/tsconfig.json`

**User Changes Applied**:

- `docker-compose.dev.yml`: RabbitMQ service not added (user rejected - likely not needed for dev)
- Constants structure: Changed to object-based pattern (`RABBITMQ_QUEUE.AI_CAPABILITY_JOBS`) for better organization
- Tasks service: Uses `SERVICE_URL` instead of `TASKS_SERVICE_BASE_URL` for self-reference
- AI service: Uses `url()` validator for `TASKS_SERVICE_BASE_URL` (better validation)

**Issues Encountered**:

- None

**Test Results**:

- `npm run type-check:ci`: ✅ Pass (verified after user changes)
- `npm run test`: ✅ Pass (274 tests passed - from initial run)

**Notes**:

- `.env.example` files are filtered by gitignore, so they need to be manually updated with:
  - AI service: `RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672` and `TASKS_SERVICE_BASE_URL=http://tasks:3001` (for docker) or `http://localhost:3001` (for local)
  - Tasks service: `SERVICE_URL=http://tasks:3001` (for docker) or `http://localhost:3001` (for local)
- Future sections will use `RABBITMQ_QUEUE.AI_CAPABILITY_JOBS` and `RABBITMQ_DLQ.AI_CAPABILITY_JOBS_DLQ` instead of the flat constant names
- Tasks service webhook will use `env.SERVICE_URL` to construct callback URLs

### Section 2: AI Service - RabbitMQ Client

**Status**: ✅ Complete

**Completed**:

- Added RabbitMQ dependencies to `package.json`:
  - `amqp-connection-manager: ^4.1.14`
  - `amqplib: ^0.10.4`
  - `@types/amqplib: ^0.10.4` (devDependencies)
- Created `backend/services/ai/src/clients/rabbitmq.ts` with:
  - Connection manager using `connect([env.RABBITMQ_URL])` for automatic reconnection
  - `publishJob(queueName, jobData)`: Publishes jobs to RabbitMQ queue with:
    - Queue assertion (creates if doesn't exist, durable=true)
    - Message serialization (JSON to Buffer)
    - Persistent messages (survive broker restart)
    - One-time send pattern (prevents duplicate sends on reconnection)
  - `createConsumer(queueName, handler)`: Creates consumer with:
    - Queue assertion (durable=true)
    - Prefetch=1 (fair distribution among workers)
    - Manual acknowledgment (noAck=false)
    - Error handling with permanent vs transient failure detection
    - Automatic requeue on transient failures
    - Discard on permanent failures (4xx errors)
    - Detailed logging with requestId context
  - `publishToDLQ(queueName, jobData, error)`: Publishes failed jobs to DLQ with:
    - Original job data and error details
    - Timestamp for manual inspection
    - Persistent messages
    - One-time send pattern
- Created `backend/services/ai/src/mocks/rabbitmq-mock.ts` with:
  - Mock functions for `publishJob`, `createConsumer`, and `publishToDLQ`
  - `resetRabbitMQMocks()` helper for test cleanup
  - Uses `vi.fn()` from vitest

**Files Created**:

- `backend/services/ai/src/clients/rabbitmq.ts`
- `backend/services/ai/src/mocks/rabbitmq-mock.ts`

**Files Modified**:

- `backend/services/ai/package.json` (added RabbitMQ dependencies)

**Issues Encountered**:

- Type error: `Connection` type not exported from `amqp-connection-manager` - Fixed by removing type annotation
- Channel access: `ChannelWrapper` doesn't expose `channel` property directly - Fixed by using channel from `addSetup` callback
- Message sending pattern: `addSetup` runs on every reconnection, so sending inside it would send multiple times - Fixed by using one-time send pattern with flag
- Mock type arguments: `vi.fn()` doesn't accept multiple type parameters like `vi.fn<[args], return>()` - Fixed by using `vi.fn()` without type arguments (TypeScript infers types)
- Unused imports: Removed `RABBITMQ_QUEUE` and `RABBITMQ_DLQ` imports from rabbitmq.ts client - These constants are meant to be used by callers (async executor, worker), not inside the client itself. The client functions accept `queueName` as a parameter for flexibility.

**Test Results**:

- `npm run type-check:ci`: ✅ Pass (fixed mock type arguments - `vi.fn()` doesn't accept multiple type parameters)
- `npm run test`: ✅ Pass (user confirmed)

**Notes**:

- **IMPORTANT**: Run `npm install` in `backend/services/ai` before running validation
- **Environment Configuration**: Add `RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672` to `.env.dev` (for Docker) or `amqp://guest:guest@localhost:5672` (for local development)
- Connection manager automatically handles reconnection - no manual intervention needed
- Channel wrapper pattern ensures channels are recreated after connection loss
- `addSetup` is used for setup that needs to run on every reconnection (queue assertion)
- One-time operations (message sending) use a flag pattern to prevent duplicate sends
- Consumer uses `addSetup` to ensure consumer is recreated after reconnection
- Prefetch=1 ensures fair distribution among multiple workers
- Message acknowledgment: ack on success, nack with requeue on transient failures, nack without requeue on permanent failures
- DLQ includes both original job data and error details for manual inspection and potential replay
- All functions include detailed comments explaining RabbitMQ concepts and flow
- Structured logging follows project patterns with requestId context and jobData in log context
- Constants (`RABBITMQ_QUEUE.AI_CAPABILITY_JOBS`, `RABBITMQ_DLQ.AI_CAPABILITY_JOBS_DLQ`) are used by callers of these functions, not inside the client itself

### Section 3: AI Service - Job Payload Types

**Status**: ✅ Complete

**Completed**:

- Created `backend/services/ai/src/types/job-payload.ts` with `TCapabilityJobPayload` generic type definition
  - Generic type: `TCapabilityJobPayload<TCapability extends Capability>` for type-safe capability-specific payloads
  - Created `TCapabilityJobPayloadInputMap` mapping type that maps each capability to its input type:
    - `[CAPABILITY.PARSE_TASK]: ParseTaskInput`
    - Ensures type safety: input type is inferred from the capability type
    - When new capabilities are added, they must be added to this mapping
  - Includes `capability` field (typed as `TCapability` - capability name, not full config - cannot serialize functions/schemas)
  - Includes `input` field (typed as `TCapabilityJobPayloadInputMap[TCapability]` - full validated input structure matching executeSyncPattern expectations, type-safe based on capability)
  - Includes `callbackUrl` field (Tasks service webhook endpoint)
  - Includes `requestId` field (for distributed tracing)
  - Includes `userId` field (for task creation in webhook)
  - Includes `tokenReservation` field (required, for token usage reconciliation)
  - Added JSDoc comments explaining each field and design decisions
- Updated `backend/services/ai/src/types/index.ts` to export `TCapabilityJobPayload` using barrel export pattern
  - Type is now accessible via `@types` path alias (e.g., `import { TCapabilityJobPayload } from "@types"`)

**Files Created**:

- `backend/services/ai/src/types/job-payload.ts`

**Files Modified**:

- `backend/services/ai/src/types/index.ts` (added export for TCapabilityJobPayload)

**Issues Encountered**:

- None

**Test Results**:

- `npm run type-check:ci`: ✅ Pass (all TypeScript compilation checks passed)
- `npm run test`: ⚠️ Sandbox permission issue (not a code issue - type-check validates types correctly)

**Notes**:

- Type definition follows project conventions: domain types use `T` prefix (e.g., `TCapabilityJobPayload`)
- Type is exported from `types/index.ts` to enable `@types` path alias imports
- **Generic Type Pattern**: The type is generic (`TCapabilityJobPayload<TCapability extends Capability>`) to provide type safety:
  - The `capability` field is typed as `TCapability` (specific capability, not just `Capability`)
  - The `input` field is typed as `TCapabilityJobPayloadInputMap[TCapability]` (input type inferred from capability)
  - This ensures compile-time type safety: the input type must match the capability type
- **Input Mapping**: `TCapabilityJobPayloadInputMap` maps each capability to its input type:
  - Currently maps `CAPABILITY.PARSE_TASK` to `ParseTaskInput`
  - When new capabilities are added, they must be added to this mapping to maintain type safety
  - The mapping is a private type (not exported) as it's an implementation detail
- The `capability` field stores only the capability name (string), not the full `CapabilityConfig` object, because:
  - `CapabilityConfig` contains functions (handler) and Zod schemas that cannot be serialized to JSON
  - The worker will look up the config from the capabilities registry using the capability name
  - This differs from sync flow which uses `res.locals.capabilityConfig` (already validated by middleware)
- The `input` field stores the complete validated input structure (params, query, body) so it can be passed directly to `executeSyncPattern`
- Type-check passed successfully, confirming type definitions are correct and properly exported
- **Usage Example**: When creating payloads, specify the capability type:
  ```typescript
  const payload: TCapabilityJobPayload<typeof CAPABILITY.PARSE_TASK> = {
    capability: CAPABILITY.PARSE_TASK,
    input: parseTaskValidatedInput, // TypeScript ensures this matches ParseTaskInput
    // ... other fields
  };
  ```

### Section 4: AI Service - Async Pattern Executor

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 5: AI Service - Worker Implementation

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 6: Tasks Service - Webhook Types and Schemas

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 7: Tasks Service - Webhook Endpoint Implementation

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 8: Tasks Service - Async Flow Implementation

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 9: Metrics Updates

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 10: Testing and Documentation

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

## Summary

[Final summary when all sections are complete]
