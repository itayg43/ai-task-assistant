# Plan 1.2: Tasks Service - Sync Operations

## Overview

Implement manual metrics recording for sync operations in the Tasks service by removing the existing metrics middleware and utilizing the refined `withMetrics` helper.

## Proposed Changes

### 1. Middleware Cleanup

- **Action**: Remove `tasksMetricsMiddleware` from the Tasks service router.
- **File**: `backend/services/tasks/src/routers/index.ts`
- **Details**:
  - Removed `tasksMetricsMiddleware` imports and usage.
  - Kept `requestResponseMetadata` as it's needed for requestId propagation.
- **Cleanup**: Deleted `backend/services/tasks/src/middlewares/metrics-middleware/` directory.

### 2. Tasks Controller Update

- **File**: `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`
- **Action**: use the `withMetrics` helper in the `getTasks` controller.
- **Implementation Details**:
  - Wrapped `getTasksHandler` call and response logic with `withMetrics`.
  - Moved `getAuthenticationContext` and `getValidatedQuery` inside the `withMetrics` callback to include them in timing if needed/for cleaner scope.
  - Used generics for `withMetrics<GetTasksResponse, TasksOperation>` to ensure type safety.
  - Configured with `TASKS_OPERATION.GET_TASKS`, `requestId`, and the specific recorder functions.

```typescript
// Implemented usage:
await withMetrics(
  {
    operation: TASKS_OPERATION.GET_TASKS,
    requestId,
    onRecordSuccess: recordTasksApiSuccess,
    onRecordFailure: recordTasksApiFailure,
  },
  async () => {
    const { userId } = getAuthenticationContext(res);
    const query = getValidatedQuery<GetTasksInput["query"]>(res);
    // ... handler execution and response
  },
);
```

### 3. Shared Utilities Update

- **File**: `backend/shared/src/utils/with-metrics/with-metrics.ts`, `backend/shared/src/types/with-metrics-options.ts`
- **Action**: Made utilities generic.
- **Details**: Added `TOperation extends string` generic parameter to support service-specific operation enums (e.g., `TasksOperation`) to match the recorder function signatures.

### 4. Verification Plan

- **Integration Tests**:
  - Updated `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.integration.test.ts`.
  - Used `vi.hoisted` to create stable mocks for `recordTasksApiSuccess` and `recordTasksApiFailure`.
  - Added specific test case: "should return 500 and record failure metrics when an unexpected error occurs".
  - Verified success metrics recording in the happy path test.
- **Type Checking**:
  - Verified `npm run type-check` passes for both shared and tasks workspaces.
- **Test Strategy Update**:
  - Deleted redundant `tasks-controller.unit.test.ts`.
  - Relying on integration tests for generic controller logic as they provide higher value and less maintenance overhead for "pass-through" controllers.
