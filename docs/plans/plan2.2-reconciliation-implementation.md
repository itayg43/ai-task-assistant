# Plan 2.2: Async Flow Integration & Token Reconciliation

## Overview

Integrate the `TokenUsageService` into the Tasks Service and Webhook controllers to enable token reconciliation and accurate duration-based metrics for async task creation.

## Proposed Changes

### 1. Task Creation Flow (Store Metadata)

- **File**: `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`
- **Action**: Update the `createTask` handler to store metadata in Redis.
- **Details**:
  - Capture `startTime = Date.now()`.
  - If `res.locals.tokenUsage` exists, call `storeRequestMetadata` after the AI service returns `202 Accepted`.
  - Include `userId`, `tokensReserved`, `windowStartTimestamp`, `startTime`, and service/limiter names.

### 2. Webhook Callback (Reconcile & Finish Metrics)

- **File**: `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.ts`
- **Action**: Update the `createTask` webhook to reconcile tokens and record duration.
- **Details**:
  - Extract `requestId` from the query string.
  - Call `reconcileTokenUsageFromCallback` with the `requestId` and actual tokens (extracted from `openaiMetadata`).
  - Calculate `durationMs = Date.now() - startTime` (if `startTime` was retrieved).
  - Update the `recordTasksApiSuccess` call to use the actual `durationMs` instead of the current `0`.
  - Ensure robust error handling around reconciliation so callback processing continues even if reconciliation fails.

### 3. Service Call Clean-up (Optional/Refinement)

- **File**: `backend/services/tasks/src/services/tasks-service.ts`
- **Action**: Ensure `createTaskHandler` only passes the `requestId` in the `callbackUrl`.
- **Note**: `startTime` is no longer needed in the URL as it is now stored in Redis.

## Verification Plan

### Test Standards & Rules Compliance

- **Strict Typing**: Use `Mocked<T>` for service dependencies and typed variables for mocks.
- **Direct Import Assertion**: Assert directly on imported metrics functions (`recordTasksApiSuccess`, `recordTasksApiFailure`).
- **Scoped Mock Variables**: Use the `mocked` prefix for `storeRequestMetadata` and `reconcileTokenUsageFromCallback`.
- **Testing Observability**: Verify that success metrics are called with the calculated duration and failure metrics are called on reconciliation/processing errors.
- **Mandatory Isolation**: Ensure `vi.clearAllMocks()` is called in `afterEach`.

### Verification Commands

```bash
# Run integration tests
npm test -- run backend/services/tasks/src/controllers/tasks-controller/
npm test -- run backend/services/tasks/src/controllers/webhooks-controller/

# Verify type safety
npm run type-check:ci
```

### Integration Tests

- **File**: `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.integration.test.ts`
  - Verify `storeRequestMetadata` is called with matching `requestId` and `startTime` after successful request queuing.
- **File**: `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`
  - Verify `reconcileTokenUsageFromCallback` is called upon receiving a callback.
  - Verify `recordTasksApiSuccess` is called with a non-zero duration (mock `reconcileTokenUsageFromCallback` to return a `startTime` from 1 second ago).
