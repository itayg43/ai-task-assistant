# OpenAI API Monitoring Implementation

## Overview

This document tracks the implementation of **OpenAI API Monitoring with Prometheus and Grafana**. The implementation adds comprehensive metrics tracking for OpenAI API requests including request counts, success rates, duration percentiles, and token usage with cost tracking.

## Implementation Plan

The implementation is broken down into the following parts:

- [x] **Part 1: Infrastructure Setup** - Docker Compose services, Prometheus and Grafana configuration
- [x] **Part 2: Code Setup** - Dependencies, TypeScript config, Metrics module creation
- [x] **Part 3: Metrics Router Integration** - Integrate metrics router into app
- [x] **Part 4: Instrument executeParse** - Add metrics tracking to OpenAI client
- [x] **Part 5: Dashboard Provisioning** - Set up Grafana dashboard provisioning and create OpenAI API dashboard

## Part 1: Infrastructure Setup

#### 1.1 Docker Compose - Prometheus Service

**File**: `docker-compose.yml`

Added Prometheus service configuration:

- Image: `prom/prometheus:latest`
- Port: `9090:9090`
- Volumes: Prometheus config and data persistence
- Network: Default Docker network

#### 1.2 Docker Compose - Grafana Service

**File**: `docker-compose.yml`

Added Grafana service configuration:

- Image: `grafana/grafana:latest`
- Port: `3000:3000`
- Environment: Admin credentials (admin/admin)
- Volumes: Grafana data and provisioning configs
- Depends on: Prometheus

#### 1.3 Prometheus Configuration

**File**: `prometheus/prometheus.yml`

Created Prometheus configuration:

- Scrape interval: 15 seconds
- Target: `ai:3002` (AI service)
- Metrics path: `/metrics`
- Labels: service and environment tags

#### 1.4 Grafana Data Source Provisioning

**File**: `grafana/provisioning/datasources/prometheus.yml`

Created auto-provisioning configuration for Prometheus data source:

- Auto-configures Prometheus connection on Grafana startup
- URL: `http://prometheus:9090`
- Set as default data source

#### 1.5 Grafana Dashboard Directory

**File**: `docker-compose.yml`

Added volume mount for dashboard provisioning:

- Volume: `./grafana/dashboards:/etc/grafana/dashboards`
- Allows dashboard JSON files to be stored in version control
- Dashboards are automatically loaded by Grafana provisioning

## Part 2: Code Setup

#### 2.1 Install Dependencies

**File**: `backend/services/ai/package.json`

Added `prom-client` dependency:

- Version: `^15.1.0`
- Installed via `npm install`

#### 2.2 Update TypeScript Configuration

**File**: `backend/services/ai/tsconfig.json`

Added path alias for metrics:

- `"@metrics/*": ["src/metrics/*"]`

#### 2.3 Create Metrics Module

**File**: `backend/services/ai/src/metrics/openai-metrics.ts`

Created metrics module with:

- **Registry**: `register` - Prometheus metrics registry
- **Counter**: `openaiApiRequestsTotal` - Tracks total API requests with labels: `capability`, `operation`, `status`
- **Histogram**: `openaiApiRequestDurationMs` - Tracks request duration with buckets [1000, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000]ms
- **Counter**: `openaiApiTokensTotal` - Tracks token usage with labels: `capability`, `operation`, `type`, `model`
- **Helper Functions**:
  - `recordOpenAiApiSuccessMetrics()` - Records success metrics (requests, duration, tokens)
    - Uses type-safe model parameter: `ResponseCreateParamsNonStreaming["model"]`
  - `recordOpenAiApiFailureMetrics()` - Records failure metrics (requests only, no duration)

## Part 3: Metrics Router Integration

#### 3.1 Create Metrics Route Constant

**File**: `backend/shared/src/constants/metrics-route.ts`

Created metrics route constant:

- `METRICS_ROUTE = "/metrics"` - Centralized route constant
- Exported from shared constants for reuse across services

#### 3.2 Update CORS Middleware

**File**: `backend/shared/src/middlewares/cors/create-cors/create-cors.ts`

Updated CORS middleware to allow metrics endpoint:

- Added `isMetricsEndpoint()` function to check if path includes `METRICS_ROUTE`
- Updated `handleNoOrigin()` to allow no-origin requests to metrics endpoint (similar to health endpoint)
- Metrics endpoint is now accessible without origin header (for Prometheus scraping)

#### 3.3 Integrate Metrics Router

**File**: `backend/services/ai/src/app.ts`

Added metrics router integration:

- Imported `metricsRouter` from `@routers/metrics-router`
- Imported `METRICS_ROUTE` from `@shared/constants`
- Added route: `app.use(METRICS_ROUTE, metricsRouter)`
- Placed before authentication middleware so Prometheus can scrape without auth
- Metrics endpoint accessible at `/metrics` (via `METRICS_ROUTE` constant)

**File**: `backend/services/ai/src/routers/metrics-router.ts`

Router handles root path `/` (which becomes `/metrics` when mounted):

- Imports `register` from `@metrics/openai-metrics`
- Route: `metricsRouter.get("/", ...)`
- Returns Prometheus metrics format
- Error handling with logging

## Part 4: Instrument executeParse

#### 4.1 Add Metrics Imports

**File**: `backend/services/ai/src/clients/openai/openai.ts`

Added imports for metrics helper functions from `@metrics/openai-metrics`:

- `recordOpenAiApiSuccessMetrics` - Helper function to record success metrics
- `recordOpenAiApiFailureMetrics` - Helper function to record failure metrics

#### 4.2 Retry Logic Integration

**File**: `backend/services/ai/src/clients/openai/openai.ts`

Retry logic was moved from the handler level (`execute-sync-pattern`) into `executeParse` to ensure metrics accurately reflect final outcomes:

- **Retry wrapper**: The OpenAI API call is wrapped with `withRetry` inside `executeParse`
- **Duration measurement**: `withDurationAsync` wraps the retry logic to measure total time including retry delays
- **Metrics boundary**: Metrics are recorded after retries complete (final outcome only)
- **Result**: One logical operation = one metric entry, regardless of retry attempts

**Key Design Decision**: This ensures that if an API call fails 3 times, we record 1 failure metric (not 3), providing accurate business-level metrics for success rates, alerting, and SLO tracking.

#### 4.3 Instrument Success Path

Added metrics recording in success case using `recordOpenAiApiSuccessMetrics()`:

- **Function call**: `recordOpenAiApiSuccessMetrics(capability, operation, prompt.model, durationMs, inputTokens, outputTokens)`
- **Type Safety**: Model parameter uses `ResponseCreateParamsNonStreaming["model"]` type for compile-time validation
- **Timing**: Metrics are recorded after retries complete successfully (final success only)
- **Records**:
  - Request counter with labels `{capability, operation, status: "success"}`
  - Duration histogram with `durationMs` value and success status (includes retry delays)
  - Input token counter with labels `{capability, operation, type: "input", model}`
  - Output token counter with labels `{capability, operation, type: "output", model}`

#### 4.4 Instrument Failure Path

Added metrics recording in failure case using `recordOpenAiApiFailureMetrics()`:

- **Function call**: `recordOpenAiApiFailureMetrics(capability, operation)`
- **Timing**: Metrics are recorded after all retries are exhausted (final failure only)
- **Records**:
  - Request counter with labels `{capability, operation, status: "failure"}`
  - No duration recorded (as per plan, to avoid skewing metrics with incomplete or network error durations)

#### 4.5 Model Type Safety

- Model is passed directly from `prompt.model` to `recordOpenAiApiSuccessMetrics()`
- Type safety: The function signature uses `ResponseCreateParamsNonStreaming["model"]` type
- This ensures compile-time validation that the model matches OpenAI's expected type
- Model is included in token metrics labels for cost tracking in Grafana

#### 4.6 Code Refactoring Benefits

The use of helper functions provides:

- **Encapsulation**: Metrics recording logic is centralized in the metrics module
- **Cleaner code**: `executeParse` function is more readable and maintainable
- **Easier maintenance**: Changes to metric recording happen in one place
- **Better testability**: Helper functions can be tested independently
- **Accurate metrics**: Retry logic at the API boundary ensures metrics reflect final outcomes

## Part 5: Dashboard Provisioning

#### 5.1 Dashboard Provisioning Configuration

**File**: `grafana/provisioning/dashboards/dashboards.yml`

Created dashboard provisioning configuration:

- **Provider**: File-based dashboard provider
- **Path**: `/etc/grafana/dashboards` (mounted from `./grafana/dashboards`)
- **Update Interval**: 10 seconds (auto-reloads dashboard changes)
- **UI Updates**: Enabled (allows editing dashboards in Grafana UI)
- **Folder Structure**: Supports subdirectories for organizing dashboards

#### 5.2 Dashboard Directory Structure

**Directory**: `grafana/dashboards/`

Created directory for storing dashboard JSON files:

- Dashboards stored as JSON files in version control
- Automatically loaded on Grafana startup
- Changes to JSON files are picked up automatically (every 10 seconds)
- Supports folder structure for organizing multiple dashboards

#### 5.3 OpenAI API Dashboard

**File**: `grafana/dashboards/openai-api-dashboard.json`

Created comprehensive OpenAI API monitoring dashboard organized into three sections:

**Key Performance Indicators (Parse Task Capability - Top Row):**

- **Requests**: Shows total number of requests for the parse-task capability in the selected time range

  - Query: `floor(sum(increase(openai_api_requests_total{capability="parse-task"}[$__range])))`
  - Uses `$__range` variable to respect Grafana's time picker

- **Success Rate**: Displays success rate percentage for the parse-task capability with color-coded thresholds

  - Query: `sum(increase(openai_api_requests_total{status="success",capability="parse-task"}[$__range])) / sum(increase(openai_api_requests_total{capability="parse-task"}[$__range])) * 100`
  - Thresholds: Red (<95%), Orange (95-98%), Yellow (98-99%), Green (>99%)

- **Cost (per 1K tokens)**: Shows total cost for the parse-task capability in the selected time range
  - Query: `(sum(increase(openai_api_tokens_total{capability="parse-task", type="input", model="gpt-4.1-mini"}[$__range])) * 0.0004 / 1000) + (sum(increase(openai_api_tokens_total{capability="parse-task", type="output", model="gpt-4.1-mini"}[$__range])) * 0.0016 / 1000)`
  - Pricing: gpt-4.1-mini - Input: $0.0004 per 1K tokens, Output: $0.0016 per 1K tokens
  - Excludes test usage (gpt-4.1 model)
  - Unit: USD currency format with 2 decimal places

**Operation Breakdowns (Parse Task Capability - Second Row):**

- **Requests Distribution**: Pie chart showing core vs subtasks operations

  - Query: `floor(sum by (operation) (increase(openai_api_requests_total{capability="parse-task"}[$__range])))`

- **Average Duration**: Line chart comparing average duration for core vs subtasks operations over time

  - Query: `sum by (operation) (increase(openai_api_request_duration_ms_sum{capability="parse-task"}[$__range])) / sum by (operation) (increase(openai_api_request_duration_ms_count{capability="parse-task"}[$__range]))`
  - Uses histogram sum/count pattern for accurate average calculation
  - Unit: milliseconds (ms)
  - Visualization: Line chart with separate lines for core and subtasks

- **P95 Duration**: Line chart comparing 95th percentile duration for core vs subtasks operations over time

  - Query: `histogram_quantile(0.95, sum by (operation, le) (increase(openai_api_request_duration_ms_bucket{capability="parse-task"}[$__range])))`
  - Unit: milliseconds (ms)
  - Visualization: Line chart with separate lines for core and subtasks

- **Average Tokens per Request**: Line chart showing average tokens per request broken down by operation (core/subtasks) and type (input/output)

  - Input tokens query: `sum by (operation) (increase(openai_api_tokens_total{capability="parse-task", type="input"}[$__range])) / sum by (operation) (increase(openai_api_requests_total{capability="parse-task", status="success"}[$__range]))`
  - Output tokens query: `sum by (operation) (increase(openai_api_tokens_total{capability="parse-task", type="output"}[$__range])) / sum by (operation) (increase(openai_api_requests_total{capability="parse-task", status="success"}[$__range]))`
  - Visualization: Line chart with four series: core-input, core-output, subtasks-input, subtasks-output
  - Unit: tokens (short format, e.g., "1K")

- **Average Cost per 100 Requests**: Line chart showing average cost per 100 requests broken down by operation (core/subtasks) and type (input/output)
  - Input cost query: `((sum by (operation) (increase(openai_api_tokens_total{capability="parse-task", type="input", model="gpt-4.1-mini"}[$__range])) * 0.0004 / 1000) / sum by (operation) (increase(openai_api_requests_total{capability="parse-task", status="success"}[$__range]))) * 100`
  - Output cost query: `((sum by (operation) (increase(openai_api_tokens_total{capability="parse-task", type="output", model="gpt-4.1-mini"}[$__range])) * 0.0016 / 1000) / sum by (operation) (increase(openai_api_requests_total{capability="parse-task", status="success"}[$__range]))) * 100`
  - Pricing: gpt-4.1-mini - Input: $0.0004 per 1K tokens, Output: $0.0016 per 1K tokens
  - Visualization: Line chart with four series: core-input, core-output, subtasks-input, subtasks-output
  - Unit: USD currency format with 2 decimal places
  - Note: Shows cost per 100 requests for better readability (multiplied by 100)

**Security Monitoring (Prompt Injection Detection - Third Row):**

- **Prompt Injection Blocked**: Total count of blocked prompt injection attempts

  - Query: `floor(sum(increase(prompt_injection_blocked_total[$__range])))`

- **Blocked by Pattern Type**: Breakdown of blocked prompt injection attempts by detection pattern
  - Query: `floor(sum by (pattern_type) (increase(prompt_injection_blocked_total[$__range])))`
  - Visualization: Pie chart showing distribution by pattern type (instruction_override, output_override, prompt_extraction)
