# Plan 1.3: AI Service - Async Operations (COMPLETED)

## Overview

Implement manual metrics recording for async operations in the AI service. This ensures that the actual duration of the heavy AI workload (including queue time) is captured in the consumer.

## Proposed Changes

### Capture Start Time

- **File**: `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`
- **Action**:
  - Capture `startTime` using `Date.now()` (since `performance.now()` is not valid across process boundaries) and include it in the `sendMessageToRabbitMQQueue` payload.

### Queue Schema Update

- **File**: `backend/services/ai/src/schemas/capabilities-queue-message-data.ts`
- **Action**: Add `startTime: z.number()` to the schema.

### AI Consumer Recording

- **File**: `backend/services/ai/src/consumers/capabilities-consumer/capabilities-consumer.ts`
- **Action**:
  - Extract `startTime` from the message data.
  - Calculate `durationMs = Date.now() - startTime`.
  - Import `recordAiApiSuccess`, `recordAiApiFailure` from `@metrics/ai-service-metrics`.
  - Record success metrics **after** execution but **before** sending the callback result:
    ```typescript
    recordAiApiSuccess(capability, durationMs, requestId);
    ```
  - Record failure metrics in the catch block:
    ```typescript
    recordAiApiFailure(capability, requestId);
    ```
    (Note: Failure recording does not currently accept duration).

## Verification Plan

- Send a request to `POST /api/v1/capabilities/execute`.
- Verify the consumer logs "Recorded AI API success metrics" with a valid duration (likely > 0ms).
- Verify Prometheus metrics for `ai_api_requests_total` and `ai_api_request_duration_ms`.
