# Plan 1.2: Tasks Service - Sync Operations

## Overview

Implement manual metrics recording for sync operations in the Tasks service, starting with the `getTasks` endpoint.

## Proposed Changes

### Tasks Controller

- **File**: `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`
- **Action**: Use the `withMetrics` helper in the `getTasks` controller.
- **Metrics Recorded**:
  - Success/Failure count
  - Operation duration
  - Vague input (where applicable)
  - Prompt injection (where applicable)

## Verification Plan

- Integration test: Call `GET /api/v1/tasks` and verify Prometheus metrics increment.
- Ensure `requestId` is passed correctly to ensure log correlation.
