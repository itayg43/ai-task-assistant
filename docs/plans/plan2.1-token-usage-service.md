# Plan 2.1: Token Usage Service (Infrastructure)

## Overview

Implement the core logic for storing and retrieving request metadata in Redis. This service will be used to reconcile token usage and capture request duration across the asynchronous boundary of AI operations.

## Proposed Changes

### 1. Token Usage Service Implementation

Create a new service directory in the Tasks Service: `backend/services/tasks/src/services/token-usage-service/`.

#### 1.1 Store Request Metadata

- **File**: `backend/services/tasks/src/services/token-usage-service/store-request-metadata.ts`
- **Function**: `storeRequestMetadata(requestId: string, metadata: RequestMetadata): Promise<void>`
- **Behavior**: Stores metadata in Redis with a 1-hour TTL using `redis.setex`. Key format: `request-metadata:${requestId}`.

#### 1.2 Get Request Metadata

- **File**: `backend/services/tasks/src/services/token-usage-service/get-request-metadata.ts`
- **Function**: `getRequestMetadata(requestId: string): Promise<RequestMetadata | null>`
- **Behavior**: Retrieves and parses metadata from Redis.

#### 1.3 Reconcile Token Usage

- **File**: `backend/services/tasks/src/services/token-usage-service/reconcile-token-usage-from-callback.ts`
- **Function**: `reconcileTokenUsageFromCallback(requestId: string, actualTokens: number, lockTtlMs: number): Promise<ReconcileResult>`
- **Behavior**:
  - Fetches metadata from Redis.
  - If found, uses `withLock` and the shared `updateTokenUsage` utility to reconcile reserved vs actual tokens.
  - Deletes the metadata from Redis.
  - Returns `ReconcileResult` containing the `startTime`.
- **Resilience**: Logs warnings if metadata is missing but does not throw.

#### 1.4 Service Index

- **File**: `backend/services/tasks/src/services/token-usage-service/index.ts`
- **Behavior**: Exports the public API of the service.

## Verification Plan

### Test Standards & Rules Compliance

- **Strict Typing**: Use `Mocked<typeof redis>` and `Mocked<typeof redlock>` from `@shared/types`.
- **Golden Template**: Follow the standard test structure with top-level `vi.mock()`, direct import assertions, and `beforeEach`/`afterEach` blocks.
- **Mandatory Isolation**: Call `vi.clearAllMocks()` in `afterEach`.
- **Mock Patterns**: Use direct import assertions for `redis` calls where appropriate, and the `mocked` prefix for complex overrides.

### Verification Commands

```bash
# Run unit tests
npm test -- run backend/services/tasks/src/services/token-usage-service/

# Verify type safety
npm run type-check:ci
```

### Unit Tests

Create the following test files:

- `backend/services/tasks/src/services/token-usage-service/store-request-metadata.test.ts`
- `backend/services/tasks/src/services/token-usage-service/reconcile-token-usage-from-callback.test.ts`

**Key Scenarios**:

- Successful storage (verify `redis.setex` args and TTL).
- Retrieval and JSON parsing (including error handling for invalid JSON).
- Token reconciliation (verify `updateTokenUsage` called with correct args inside `withLock`).
- Cleanup (verify `redis.del` called after reconciliation).
- Handling of missing metadata (verify it returns an empty object and logs a warning).
