# Plan 1.3: AI Service - Async Operations

## Overview

Implement manual metrics recording for async operations in the AI service. This ensures that the actual duration of the heavy AI workload is captured in the worker.

## Proposed Changes

### Capture Start Time

- **File**: `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`
- **Action**: Capture `startTime` using `getStartTimestamp()` and include it in the `sendMessageToRabbitMQQueue` payload.

### Queue Schema Update

- **File**: `backend/services/ai/src/schemas/capabilities-queue-message.ts`
- **Action**: Add `startTime: z.number()` to the schema.

### AI Worker Recording

- **File**: `backend/services/ai/src/workers/capabilities-worker.ts`
- **Action**:
  - Extract `startTime` from the message.
  - Record success or failure metrics **after** execution but **before** sending the callback result back to the Tasks service.

## Verification Plan

- Send a request to `POST /api/v1/capabilities/execute`.
- Verify the worker logs "Recorded AI API success metrics" with a valid duration.
- Verify Prometheus metrics for `ai_api_requests_total` and `ai_api_request_duration_ms`.
