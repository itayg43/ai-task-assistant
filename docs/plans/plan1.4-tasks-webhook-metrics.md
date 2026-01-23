# Plan 1.4: Tasks Service - Async Callbacks

## Overview

Implement metrics recording for the async task creation flow in the Tasks Service. This involves updating the `webhooks-controller` to record success, failure, and security-related metrics when a callback is received from the AI Service. The implementation will be verified with integration tests covering all controller logic.

## Proposed Changes

### 1. Webhooks Controller Update

- **File**: `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.ts`
- **Action**: Implement manual metrics recording and ensure robust handling of the callback payload.
- **Details**:
  - **Success Path**: Recorded with `durationMs: 0`.
  - **AI Failure Path**: Recorded with `recordTasksApiFailure`. Specific classification (Vague/Injection) extracted from `req.body.error.context.type`.
  - **Internal Failure Path**: Recorded with `recordTasksApiFailure` in `catch` block.
  - **Resiliency**: Webhook always returns `200 OK`.

### 2. Integration Test Coverage

- **File**: `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`
- **Action**: Implemented comprehensive integration tests coverging success, classified failures, and processing errors.
- **Standards Applied**:
  - Followed updated **Testing Standards**:
    - Used **Direct Import Assertion** for metrics recorders.
    - Used **Typed Mock Variables** (`Mocked<T>`) for `createTaskHandler`.
    - Applied **Clean Data Strategy**: Reused shared mocks (`mockUserId`, `mockAiCapabilityResponse`) and scoped constants (like `mockAiRequestId`) inside `describe` blocks.
    - Improved **Test Expressiveness**: Updated descriptions and assertions to use constants (`AI_ERROR_TYPE`) for better clarity.
    - Avoided `vi.hoisted`.
    - Implemented mandatory isolation with `afterEach` and initialization in `beforeEach`.

## Verification Status

- **Integration Tests**: PASSED (Ran `npm test -- run backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`).
- **Type Check**: PASSED (Ran `npm run type-check:ci`).

## Outcomes

- Metrics are now recorded for the async task creation flow.
- The Tasks Service is independently observable for webhook processing.
- The codebase aligns with reinforced testing and execution standards.
