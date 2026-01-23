# Plan 1.1: Metrics Infrastructure

## Overview

This plan focuses on making current metrics recording functions resilient by handling internal failures and providing a shared utility for sync operation timing and recording.

## Proposed Changes

### Metrics Functions Resilience

Wrap the following functions in `try-catch` blocks to ensure metrics failures never break business logic:

1.  **AI Service**:
    - `recordAiApiSuccess` in `backend/services/ai/src/metrics/ai-service-metrics.ts`
    - `recordAiApiFailure` in `backend/services/ai/src/metrics/ai-service-metrics.ts`
    - `recordOpenAiApiSuccessMetrics` in `backend/services/ai/src/metrics/openai-metrics.ts`
    - `recordOpenAiApiFailureMetrics` in `backend/services/ai/src/metrics/openai-metrics.ts`
    - `recordVagueInput` in `backend/services/ai/src/metrics/parse-task-metrics.ts`
    - `recordPromptInjectionBlocked` in `backend/services/ai/src/metrics/prompt-injection-metrics.ts`

2.  **Tasks Service**:
    - `recordTasksApiSuccess` in `backend/services/tasks/src/metrics/tasks-metrics.ts`
    - `recordTasksApiFailure` in `backend/services/tasks/src/metrics/tasks-metrics.ts`
    - `recordVagueInput` in `backend/services/tasks/src/metrics/tasks-metrics.ts`
    - `recordPromptInjection` in `backend/services/tasks/src/metrics/tasks-metrics.ts`

### New Shared Utility: `withMetrics`

- **File**: `backend/shared/src/utils/with-metrics/with-metrics.ts`
- **Purpose**: A wrapper for async functions that automatically handles timing and calls success/failure recorders.
- **Implementation Refinements**:
  - Uses an `options` object for configuration.
  - Recording calls are synchronous ("fire-and-forget").
  - Relies on the resilience of the recording functions themselves (no internal `try-catch` inside `withMetrics`).
- **Dependencies**: Uses `withDurationAsync`.
- **Types**: Uses centralized `WithMetricsOptions` type in `backend/shared/src/types/with-metrics-options.ts`.

## Verification Plan

- Unit tests for `withMetrics` utility in `with-metrics.test.ts`, focusing on core success and failure paths.
- General verification via `npm run type-check:ci` and existing test suites.
