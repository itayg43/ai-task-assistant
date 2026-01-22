# Plan 1.4: Tasks Service - Async Callbacks

## Overview

Record metrics for async operations in the Tasks service when results are received via webhook.

## Proposed Changes

### Webhooks Controller

- **File**: `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.ts` (Check path)
- **Action**: Call `recordTasksApiSuccess` or `recordTasksApiFailure` in the `createTask` webhook handler.
- **Metrics Recorded**:
  - Success/Failure count
  - Vague input (if callback indicates failure)
  - Prompt injection (if callback indicates failure)
- **Note**: For this phase, duration will be recorded as `0` because `startTime` is not yet shared across services. Shared `startTime` via Redis is planned for a future major iteration (Plan 2).

## Verification Plan

- Complete an async task creation flow.
- Verify `tasks_api_requests_total` is incremented for `create_task`.
