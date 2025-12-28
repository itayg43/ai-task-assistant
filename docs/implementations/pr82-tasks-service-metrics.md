# Tasks Service Metrics Implementation

## Overview

This document tracks the implementation of **Tasks Service Prometheus Metrics**. The implementation adds comprehensive metrics tracking for the Tasks service operations including request counts, success rates, duration percentiles, and vague input error tracking. Additionally, it refactors the Prometheus registry to be shared between both AI and Tasks services.

## Implementation Details

### 1. Refactor Prometheus Registry and Metrics Router to Shared Package

**Rationale**: Both AI and Tasks services need access to the same Prometheus registry to expose metrics through their respective `/metrics` endpoints. Additionally, both services can use the same metrics router implementation, eliminating code duplication.

**Changes**:

- Moved `backend/services/ai/src/clients/prom.ts` to `backend/shared/src/clients/prom.ts`
- Moved `backend/services/ai/src/routers/metrics-router/` to `backend/shared/src/routers/metrics-router/`
- Created `backend/shared/src/routers/index.ts` to export the shared metrics router
- Updated all imports in AI service from `@clients/prom` to `@shared/clients/prom`
- Updated AI service router imports to use `@shared/routers/metricsRouter`
- Added `prom-client: ^15.1.0` to shared package dependencies
- Deleted the old AI service prom.ts and metrics-router files

### 2. Create Generic Metrics Middleware in Shared Package

**Rationale**: Create a reusable metrics middleware factory that can be used by any service, avoiding code duplication.

**Implementation**:

- Created `createMetricsMiddleware()` factory function that accepts:
  - `operationsMap`: Maps HTTP methods to operation names (e.g., `{ "POST": "create_task" }`)
  - `recorder`: Object with `recordSuccess` and `recordFailure` functions
- Uses `getStartTimestamp()` and `getElapsedDuration()` from shared performance utils for high-resolution timing
- Automatically determines success/failure based on HTTP status codes (2xx = success, 3xx/4xx/5xx = failure)
- Skips metrics for unmapped HTTP methods

**Tests**: Created test suite covering:

- Operation mapping for different HTTP methods
- Duration tracking using performance utils
- Status code handling (2xx, 4xx, 5xx)
- Request context (requestId from res.locals)

### 3. Create Tasks Service Metrics Module

**Metrics Defined**:

1. **`tasks_api_requests_total`** (Counter)

   - Labels: `operation` (create_task | get_tasks), `status` (success | failure)
   - Tracks total number of requests

2. **`tasks_api_request_duration_ms`** (Histogram)

   - Labels: `operation`, `status`
   - Buckets: [500, 1000, 2500, 3000, 4000, 5000, 7500, 10000, 15000] ms
   - Rationale:
     - GET tasks: Fast DB queries (500-1000ms typical)
     - CREATE task: AI service call (~2500-3000ms) + DB operations
     - 7500-15000ms: Slow operations that may indicate issues

3. **`tasks_vague_input_total`** (Counter)
   - Tracks vague input errors specifically

**Helper Functions**:

- `recordTasksApiSuccess(operation, durationMs, requestId)` - Records successful request metrics
- `recordTasksApiFailure(operation, durationMs, requestId)` - Records failed request metrics
- `recordVagueInput(requestId)` - Records vague input error metric

All helper functions include `logger.debug()` calls for observability.

**Tests**: Created test suite using proper mocks:

- Mocks Counter and Histogram classes using `vi.fn()`
- Tests counter increments with correct labels for both operations (create_task, get_tasks)
- Tests histogram observations with correct labels and durations
- Tests debug logging with correct parameters
- Fast unit tests that don't depend on Prometheus internals

### 4. Wire Metrics Middleware to Tasks Router

**Implementation**:

- Created `tasksMetricsMiddleware` by calling `createMetricsMiddleware()` with:
  - Operations map: `{ POST: "create_task", GET: "get_tasks" }`
  - Recorder functions: `recordTasksApiSuccess` and `recordTasksApiFailure`
- Added middleware to both POST and GET routes in tasks-router
- Middleware is placed first in the middleware chain to capture full request duration including validation and rate limiting

### 5. Record Vague Input Metric in Controller

**Rationale**: Recording vague input metrics in the controller keeps metrics with business logic and maintains separation of concerns (token handler focuses only on token reconciliation).

**Implementation**:

- Added vague input detection in `createTask` catch block
- Checks if error is `BaseError` with type `AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR`
- Calls `recordVagueInput(requestId)` before passing error to next middleware

**Tests**: Added unit tests covering:

- Vague input metric is recorded when AI returns PARSE_TASK_VAGUE_INPUT_ERROR
- Vague input metric is NOT recorded for other error types

### 6. Add Metrics Endpoint to Tasks Service

**Implementation**:

- Reused the shared `metricsRouter` from `@shared/routers` (moved from AI service in step 1)
- Imported `metricsRouter` in `backend/services/tasks/src/routers/index.ts`
- Integrated router using `routers.use(METRICS_ROUTE, metricsRouter)`
- Router placement follows the same pattern as AI service (before authentication middleware)
- The shared router exposes GET `/metrics` endpoint that returns Prometheus-formatted metrics for all registered metrics (both OpenAI and Tasks metrics)

**Tests**:

- Shared metrics router has unit tests in `backend/shared/src/routers/metrics-router/metrics-router.test.ts`:
  - Tests successful metrics response
  - Tests error handling
  - Uses mocked Prometheus register
- Tasks service metrics are tested via unit tests in `backend/services/tasks/src/metrics/tasks-metrics/tasks-metrics.test.ts`:
  - Uses mocked Counter and Histogram
  - Tests behavior without actual Prometheus dependencies
  - Fast, isolated unit tests
- Metrics middleware has unit tests in `backend/shared/src/middlewares/metrics/metrics-middleware.test.ts`:
  - Uses reusable `createMetricsRecorderMock()` factory
  - Tests operation mapping, duration tracking, status codes, and request context

### 7. Update Prometheus Configuration

**Changes**:

- Added new scrape job `tasks-service`
- Target: `tasks:3001`
- Labels: `service: "tasks"`, `environment: "development"`
- Scrape interval: 15s
- Scrape timeout: 10s

### 8. Create Grafana Dashboard

**Dashboard Configuration**:

- Time range: Last 7 days (`now-7d` to `now`)
- Auto-refresh: Every 5 minutes
- Timezone: Browser

**Dashboard Structure**:

**Create Task Operation Section**:

- Requests (total count)
- Success Rate (%) with color thresholds (red <95%, orange 95-98%, yellow 98-99%, green >99%)
- Avg Duration (ms, success only) with thresholds (green <5000ms, yellow 5000-10000ms, red >10000ms)
- P95 Duration (ms, success only) with thresholds (green <7500ms, yellow 7500-15000ms, red >15000ms)
- Vague Input Count (total)

**Get Tasks Operation Section**:

- Requests (total count)
- Success Rate (%) with same thresholds as create task
- Avg Duration (ms, all requests) with thresholds (green <1000ms, yellow 1000-2500ms, red >2500ms)
- P95 Duration (ms, success only) with thresholds (green <2500ms, yellow 2500-5000ms, red >5000ms)

**Grafana Queries Used**:

- **Success Rate**: `sum(rate(tasks_api_requests_total{status="success"}[...])) / sum(rate(tasks_api_requests_total[...])) * 100`
- **Avg Duration (Create Task)**: `rate(tasks_api_request_duration_ms_sum{operation="create_task",status="success"}[...]) / rate(tasks_api_request_duration_ms_count{operation="create_task",status="success"}[...])`
  - Filters by `status="success"` to exclude failed requests from average calculation
- **Avg Duration (Get Tasks)**: `rate(tasks_api_request_duration_ms_sum{operation="get_tasks"}[...]) / rate(tasks_api_request_duration_ms_count{operation="get_tasks"}[...])`
  - Includes all requests (no status filter)
- **P95 Duration (Create Task)**: `histogram_quantile(0.95, sum(rate(tasks_api_request_duration_ms_bucket{operation="create_task",status="success"}[...])) by (le))`
  - Filters by `status="success"` to calculate P95 based only on successful requests
- **P95 Duration (Get Tasks)**: `histogram_quantile(0.95, sum(rate(tasks_api_request_duration_ms_bucket{operation="get_tasks",status="success"}[...])) by (le))`
  - Filters by `status="success"` to calculate P95 based only on successful requests
- **Vague Input %**: `rate(tasks_vague_input_total[...]) / rate(tasks_api_requests_total{operation="create_task"}[...]) * 100`
