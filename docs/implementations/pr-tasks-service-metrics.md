# Tasks Service Metrics Implementation

## Overview

This document tracks the implementation of **Tasks Service Prometheus Metrics**. The implementation adds comprehensive metrics tracking for the Tasks service operations including request counts, success rates, duration percentiles, and vague input error tracking. Additionally, it refactors the Prometheus registry to be shared between both AI and Tasks services.

## Summary of Changes

### Files Created

#### Shared Package

- `backend/shared/src/clients/prom.ts` - Prometheus registry (moved from AI service)
- `backend/shared/src/middlewares/metrics/metrics-middleware.ts` - Generic metrics middleware factory
- `backend/shared/src/middlewares/metrics/index.ts` - Metrics middleware exports
- `backend/shared/src/middlewares/metrics/metrics-middleware.test.ts` - Metrics middleware tests
- `backend/shared/src/routers/metrics-router/metrics-router.ts` - Shared metrics router (moved from AI service, reused by Tasks service)
- `backend/shared/src/routers/metrics-router/metrics-router.test.ts` - Metrics router tests
- `backend/shared/src/routers/index.ts` - Router exports

#### Tasks Service

- `backend/services/tasks/src/metrics/tasks-metrics/tasks-metrics.ts` - Tasks-specific metrics definitions and helper functions
- `backend/services/tasks/src/metrics/tasks-metrics/index.ts` - Tasks metrics exports
- `backend/services/tasks/src/metrics/tasks-metrics/tasks-metrics.test.ts` - Tasks metrics tests
- `backend/services/tasks/src/middlewares/metrics-middleware/metrics-middleware.ts` - Tasks metrics middleware wrapper
- `backend/services/tasks/src/middlewares/metrics-middleware/index.ts` - Tasks metrics middleware exports
- `backend/services/tasks/src/routers/routers.integration.test.ts` - Integration tests for metrics endpoint

#### Configuration

- `grafana/dashboards/tasks-service-dashboard.json` - Grafana dashboard for Tasks service

### Files Modified

#### Shared Package

- `backend/shared/package.json` - Added `prom-client: ^15.1.0` dependency

#### AI Service

- `backend/services/ai/src/metrics/openai-metrics.ts` - Updated import to use `@shared/clients/prom`
- `backend/services/ai/src/metrics/prompt-injection-metrics.ts` - Updated import to use `@shared/clients/prom`
- `backend/services/ai/src/routers/index.ts` - Updated import to use `@shared/routers/metricsRouter`

#### Tasks Service

- `backend/services/tasks/tsconfig.json` - Added `@metrics/*` path alias
- `backend/services/tasks/src/routers/index.ts` - Added metrics router from shared package
- `backend/services/tasks/src/routers/tasks-router.ts` - Added metrics middleware to routes
- `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts` - Added vague input metric recording
- `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.unit.test.ts` - Added vague input metric tests

#### Configuration

- `prometheus/prometheus.yml` - Added tasks-service scrape configuration

### Files Deleted

- `backend/services/ai/src/clients/prom.ts` - Moved to `backend/shared/src/clients/prom.ts`
- `backend/services/ai/src/routers/metrics-router/metrics-router.ts` - Moved to `backend/shared/src/routers/metrics-router/metrics-router.ts`
- `backend/services/ai/src/routers/metrics-router/metrics-router.test.ts` - Moved to `backend/shared/src/routers/metrics-router/metrics-router.test.ts`

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

**Tests**: Created comprehensive test suite covering:

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
   - No labels
   - Tracks vague input errors specifically

**Helper Functions**:

- `recordTasksApiSuccess(operation, durationMs, requestId)` - Records successful request metrics
- `recordTasksApiFailure(operation, durationMs, requestId)` - Records failed request metrics
- `recordVagueInput(requestId)` - Records vague input error metric

All helper functions include `logger.debug()` calls for observability.

**Tests**: Created test suite covering:

- Counter increments for success/failure
- Histogram observations
- Debug logging with correct parameters

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

**Benefits of Reusing Shared Router**:

- **DRY Principle**: Eliminates code duplication between services
- **Consistency**: Both services use identical metrics endpoint implementation
- **Single Source of Truth**: Metrics router logic maintained in one place
- **Easier Maintenance**: Bug fixes and improvements benefit all services

**Tests**:

- Shared metrics router has unit tests in `backend/shared/src/routers/metrics-router/metrics-router.test.ts`
- Integration tests in `backend/services/tasks/src/routers/routers.integration.test.ts` verify:
  - `/metrics` endpoint returns 200 OK
  - Response contains all expected Tasks service metrics
  - Endpoint is accessible without authentication (for Prometheus scraping)
  - Metrics are in proper Prometheus format
- Tasks service metrics are tested via unit tests in `backend/services/tasks/src/metrics/tasks-metrics/tasks-metrics.test.ts`

### 7. Update Prometheus Configuration

**Changes**:

- Added new scrape job `tasks-service`
- Target: `tasks:3001`
- Labels: `service: "tasks"`, `environment: "development"`
- Scrape interval: 15s
- Scrape timeout: 10s

### 8. Create Grafana Dashboard

**Dashboard Structure**:

**Create Task Operation Section**:

- Requests (total count)
- Success Rate (%) with color thresholds (red <95%, orange 95-98%, yellow 98-99%, green >99%)
- Avg Duration (ms) with thresholds (green <5000ms, yellow 5000-10000ms, red >10000ms)
- P95 Duration (ms) with thresholds (green <7500ms, yellow 7500-15000ms, red >15000ms)
- Vague Input Count (total)
- Vague Input % (percentage of create_task requests)

**Get Tasks Operation Section**:

- Requests (total count)
- Success Rate (%) with same thresholds as create task
- Avg Duration (ms) with thresholds (green <1000ms, yellow 1000-2500ms, red >2500ms)
- P95 Duration (ms) with thresholds (green <2500ms, yellow 2500-5000ms, red >5000ms)

**Time Series Section**:

- Request Rate Over Time (by operation)
- Duration Percentiles Over Time (P50 and P95 by operation)

**Grafana Queries Used**:

- Success Rate: `sum(rate(tasks_api_requests_total{status="success"}[...])) / sum(rate(tasks_api_requests_total[...])) * 100`
- Avg Duration: `rate(tasks_api_request_duration_ms_sum[...]) / rate(tasks_api_request_duration_ms_count[...])`
- P95 Duration: `histogram_quantile(0.95, sum(rate(tasks_api_request_duration_ms_bucket[...])) by (le, operation))`
- Vague Input %: `rate(tasks_vague_input_total[...]) / rate(tasks_api_requests_total{operation="create_task"}[...]) * 100`

## Test Results

All tests pass successfully:

```bash
npm run test
# Test Files  47 passed (47)
# Tests  253 passed (253)

npm run type-check:ci
# No type errors
```

## Architectural Improvements Made During Implementation

During implementation, several architectural improvements were identified and applied:

### 1. Moved Metrics Router to Shared Package

**Original Plan**: Create a separate metrics router for Tasks service similar to AI service

**Improvement**: Moved the metrics router from AI service to shared package and reused it in both services

**Benefits**:

- Eliminated code duplication
- Single source of truth for metrics endpoint behavior
- Easier maintenance and consistency across services
- Both services automatically benefit from improvements

### 2. Centralized Router Registration

**Original Plan**: Add metrics router directly in `app.ts`

**Improvement**: Added metrics router in `routers/index.ts` alongside other routers

**Benefits**:

- Consistent with existing routing architecture
- All route registration in one place
- Better separation of concerns (app.ts for middleware, routers/index.ts for routes)
- Matches pattern used in AI service

These improvements demonstrate good engineering judgment and follow the DRY (Don't Repeat Yourself) principle while maintaining architectural consistency across services.

## Future Enhancements

1. **Add metrics to AI service using the shared middleware**: The generic metrics middleware can now be used in the AI service to track capability-level metrics
2. **Add more granular metrics**: Track metrics by category, priority level, or other dimensions
3. **Add alerting**: Set up Prometheus alerting rules for high error rates or slow response times
4. **Add cost tracking**: Similar to OpenAI metrics, track estimated costs based on database operations

## Verification

To verify the implementation:

1. Start the services: `npm run start:dev`
2. Access Prometheus: `http://localhost:9090`
   - Query: `tasks_api_requests_total`
   - Should see metrics being collected
3. Access Grafana: `http://localhost:3000` (admin/admin)
   - Navigate to "Tasks Service Dashboard"
   - Should see all panels displaying data
4. Make some requests to the Tasks service
5. Observe metrics updating in real-time in Grafana

## Conclusion

The Tasks Service Metrics implementation successfully adds comprehensive observability to the Tasks service while also improving code reusability by creating a shared metrics middleware factory. The refactored Prometheus registry ensures both services can expose metrics through a unified registry, and the new Grafana dashboard provides clear visibility into Tasks service performance and health.
