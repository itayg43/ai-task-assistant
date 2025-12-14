# OpenAI API Monitoring Implementation

## Overview

This document tracks the implementation of **OpenAI API Monitoring with Prometheus and Grafana**. The implementation adds comprehensive metrics tracking for OpenAI API requests including request counts, success rates, duration percentiles, and token usage with cost tracking.

## Implementation Plan

The implementation is broken down into the following parts:

- [x] **Part 1: Infrastructure Setup** - Docker Compose services, Prometheus and Grafana configuration
- [x] **Part 2: Code Setup** - Dependencies, TypeScript config, Metrics module creation
- [x] **Part 3: Metrics Router Integration** - Integrate metrics router into app
- [x] **Part 4: Instrument executeParse** - Add metrics tracking to OpenAI client
- [x] **Part 5: Testing and Verification** - Test metrics endpoint and verify Prometheus scraping

## Part 1: Infrastructure Setup

**Status**: ✅ Completed

### Changes Made

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

#### 1.3 Docker Compose Dev Overrides

**File**: `docker-compose.dev.yml`

Added port mappings for Prometheus and Grafana in dev environment.

#### 1.4 Prometheus Configuration

**File**: `prometheus/prometheus.yml`

Created Prometheus configuration:

- Scrape interval: 15 seconds
- Target: `ai:3002` (AI service)
- Metrics path: `/metrics`
- Labels: service and environment tags

#### 1.5 Grafana Data Source Provisioning

**File**: `grafana/provisioning/datasources/prometheus.yml`

Created auto-provisioning configuration for Prometheus data source:

- Auto-configures Prometheus connection on Grafana startup
- URL: `http://prometheus:9090`
- Set as default data source

### Files Created

- `prometheus/prometheus.yml`
- `grafana/provisioning/datasources/prometheus.yml`

### Files Modified

- `docker-compose.yml`
- `docker-compose.dev.yml`

### Verification

To verify Part 1 is complete:

1. Check that `docker-compose.yml` has `prometheus` and `grafana` services
2. Check that `docker-compose.dev.yml` has port mappings for both services
3. Verify `prometheus/prometheus.yml` exists with correct configuration
4. Verify `grafana/provisioning/datasources/prometheus.yml` exists

### Next Steps

Awaiting approval to proceed with Part 2: Code Setup.

---

## Part 2: Code Setup

**Status**: ✅ Completed

### Changes Made

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

All metrics and helper functions are exported directly from `openai-metrics.ts`.

### Files Created

- `backend/services/ai/src/metrics/openai-metrics.ts`

### Files Modified

- `backend/services/ai/package.json` - Added `prom-client` dependency
- `backend/services/ai/tsconfig.json` - Added `@metrics/*` path alias

### Verification

To verify Part 2 is complete:

1. Check that `prom-client` is in `package.json` dependencies
2. Check that `@metrics/*` path alias exists in `tsconfig.json`
3. Verify `src/metrics/openai-metrics.ts` exists with all three metrics and helper functions
4. Verify all metrics and helper functions are exported from `openai-metrics.ts`

### Next Steps

Awaiting approval to proceed with Part 3: Metrics Router Integration.

---

## Part 3: Metrics Router Integration

**Status**: ✅ Completed

### Changes Made

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

### Files Created

- `backend/shared/src/constants/metrics-route.ts` - Metrics route constant

### Files Modified

- `backend/services/ai/src/app.ts` - Added metrics router import and route using `METRICS_ROUTE` constant
- `backend/shared/src/middlewares/cors/create-cors/create-cors.ts` - Updated to allow metrics endpoint requests
- `backend/shared/src/constants/index.ts` - Exported `METRICS_ROUTE` constant

### Verification

To verify Part 3 is complete:

1. Check that `METRICS_ROUTE` constant exists in `backend/shared/src/constants/metrics-route.ts`
2. Check that `METRICS_ROUTE` is exported from `backend/shared/src/constants/index.ts`
3. Check that CORS middleware allows metrics endpoint (no-origin requests)
4. Check that `metricsRouter` is imported in `app.ts`
5. Check that metrics router is mounted using `METRICS_ROUTE` constant
6. Verify metrics router is placed before authentication middleware
7. Verify no linter errors

### Next Steps

Awaiting approval to proceed with Part 4: Instrument executeParse.

---

## Part 4: Instrument executeParse

**Status**: ✅ Completed

### Changes Made

#### 4.1 Add Metrics Imports

**File**: `backend/services/ai/src/clients/openai/openai.ts`

Added imports for metrics helper functions from `@metrics/openai-metrics`:

- `recordOpenAiApiSuccessMetrics` - Helper function to record success metrics
- `recordOpenAiApiFailureMetrics` - Helper function to record failure metrics

#### 4.2 Instrument Success Path

Added metrics recording in success case using `recordOpenAiApiSuccessMetrics()`:

- **Function call**: `recordOpenAiApiSuccessMetrics(capability, operation, prompt.model, durationMs, inputTokens, outputTokens)`
- **Type Safety**: Model parameter uses `ResponseCreateParamsNonStreaming["model"]` type for compile-time validation
- **Records**:
  - Request counter with labels `{capability, operation, status: "success"}`
  - Duration histogram with `durationMs` value and success status
  - Input token counter with labels `{capability, operation, type: "input", model}`
  - Output token counter with labels `{capability, operation, type: "output", model}`

#### 4.3 Instrument Failure Path

Added metrics recording in failure case using `recordOpenAiApiFailureMetrics()`:

- **Function call**: `recordOpenAiApiFailureMetrics(capability, operation)`
- **Records**:
  - Request counter with labels `{capability, operation, status: "failure"}`
  - No duration recorded (as per plan, to avoid skewing metrics with incomplete or network error durations)

#### 4.4 Model Type Safety

- Model is passed directly from `prompt.model` to `recordOpenAiApiSuccessMetrics()`
- Type safety: The function signature uses `ResponseCreateParamsNonStreaming["model"]` type
- This ensures compile-time validation that the model matches OpenAI's expected type
- Model is included in token metrics labels for cost tracking in Grafana

#### 4.5 Code Refactoring Benefits

The use of helper functions provides:

- **Encapsulation**: Metrics recording logic is centralized in the metrics module
- **Cleaner code**: `executeParse` function is more readable and maintainable
- **Easier maintenance**: Changes to metric recording happen in one place
- **Better testability**: Helper functions can be tested independently

### Files Modified

- `backend/services/ai/src/clients/openai/openai.ts` - Added metrics instrumentation

### Verification

To verify Part 4 is complete:

1. Check that helper functions are imported from `@metrics/openai-metrics`
2. Verify `recordOpenAiApiSuccessMetrics()` is called in success path with correct parameters
3. Verify `recordOpenAiApiFailureMetrics()` is called in failure path
4. Verify model parameter uses type-safe `ResponseCreateParamsNonStreaming["model"]` type
5. Verify `ResponseCreateParamsNonStreaming` is imported in metrics module
6. Verify no linter errors

### Next Steps

Awaiting approval to proceed with Part 5: Testing and Verification.

---

## Part 5: Testing and Verification

**Status**: ✅ Completed

### Testing Steps

#### 5.1 Start Services

Start all services including Prometheus and Grafana:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Verify all services are running:

```bash
docker-compose ps
```

Expected services:

- `ai` (AI service on port 3002)
- `prometheus` (Prometheus on port 9090)
- `grafana` (Grafana on port 3000)
- Other existing services (tasks, redis, postgres)

#### 5.2 Verify Metrics Endpoint

Test that the metrics endpoint is accessible and returns Prometheus format:

```bash
# Test metrics endpoint
curl http://localhost:3002/metrics

# Should return Prometheus format metrics including:
# - openai_api_requests_total
# - openai_api_request_duration_ms_bucket
# - openai_api_tokens_total
```

**Expected Output**: Prometheus-formatted metrics with `# TYPE`, `# HELP`, and metric values.

**Example Output**:

```
# HELP openai_api_requests_total Total number of OpenAI API requests
# TYPE openai_api_requests_total counter
openai_api_requests_total{capability="parse-task",operation="core",status="success"} 1

# HELP openai_api_request_duration_ms Duration of OpenAI API requests in milliseconds
# TYPE openai_api_request_duration_ms histogram
openai_api_request_duration_ms_bucket{le="4000",capability="parse-task",operation="core",status="success"} 1
openai_api_request_duration_ms_sum{capability="parse-task",operation="core",status="success"} 3397.19
openai_api_request_duration_ms_count{capability="parse-task",operation="core",status="success"} 1

# HELP openai_api_tokens_total Total tokens used in OpenAI API requests
# TYPE openai_api_tokens_total counter
openai_api_tokens_total{capability="parse-task",operation="core",type="input",model="gpt-4.1-mini"} 1009
openai_api_tokens_total{capability="parse-task",operation="core",type="output",model="gpt-4.1-mini"} 75
```

**Important Note**: The `/metrics` endpoint returns raw Prometheus format data. To execute PromQL queries (like `rate()`, `sum()`, `histogram_quantile()`, etc.), you must use the **Prometheus UI** at `http://localhost:9090` (see section 5.3). PromQL queries cannot be executed against the `/metrics` endpoint directly.

**Verification Checklist**:

- [ ] Endpoint returns HTTP 200
- [ ] Content-Type is `text/plain; version=0.0.4; charset=utf-8`
- [ ] Metrics include `openai_api_requests_total` with labels (capability, operation, status)
- [ ] Metrics include `openai_api_request_duration_ms_bucket` with histogram buckets
- [ ] Metrics include `openai_api_tokens_total` with labels (capability, operation, type, model)
- [ ] All expected labels are present and have correct values

#### 5.3 Verify Prometheus Scraping

1. **Access Prometheus UI**: Open `http://localhost:9090` in browser

2. **Check Targets**:

   - Navigate to: **Status → Targets**
   - Verify `ai-service` target shows **State: UP**
   - Check **Last Scrape** timestamp is recent (within last 15 seconds)
   - Verify **Scrape Duration** is reasonable (< 1 second)

3. **Query Metrics in Prometheus UI**:

   **Important**: PromQL queries must be executed in the Prometheus UI, not against the `/metrics` endpoint. The `/metrics` endpoint only returns raw metric data.

   - Navigate to: **Graph** tab (or use the query bar at the top of the page)
   - Enter queries in the query input field and click **Execute**

   **Basic Queries** (to verify metrics are available):

   ```promql
   # View all request metrics
   openai_api_requests_total

   # View all duration metrics
   openai_api_request_duration_ms_bucket

   # View all token metrics
   openai_api_tokens_total
   ```

   **Rate Queries** (after making some API calls and waiting ~15 seconds for scraping):

   ```promql
   # Request rate per second
   rate(openai_api_requests_total[5m])

   # Success rate percentage
   sum(rate(openai_api_requests_total{status="success"}[5m])) / sum(rate(openai_api_requests_total[5m])) * 100

   # Token usage rate
   rate(openai_api_tokens_total[5m])
   ```

   **Percentile Queries**:

   ```promql
   # P95 duration
   histogram_quantile(0.95, rate(openai_api_request_duration_ms_bucket[5m]))

   # Average duration
   rate(openai_api_request_duration_ms_sum[5m]) / rate(openai_api_request_duration_ms_count[5m])
   ```

   **Note**:

   - After making API calls, wait 15 seconds (scrape interval) before queries will show new data
   - If queries return "No data", ensure:
     - API calls have been made recently
     - Prometheus has scraped the metrics (check Last Scrape time in Targets)
     - Time range in Prometheus UI includes the scrape time

**Verification Checklist**:

- [ ] Prometheus UI is accessible at `http://localhost:9090`
- [ ] `ai-service` target is UP in Status → Targets
- [ ] Basic queries return data (e.g., `openai_api_requests_total`)
- [ ] Rate queries work (may show 0 if no recent activity within the time window)
- [ ] No scrape errors in Prometheus logs

#### 5.4 Generate Test Metrics

Make API calls to generate metrics data:

```bash
# Make a test API call to the AI service
# (Use your actual API endpoint and authentication)
curl -X POST http://localhost:3002/api/v1/ai/capabilities/parse-task?pattern=sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"naturalLanguage": "Test task"}'
```

**Note**: Replace `YOUR_TOKEN` with a valid authentication token.

After making API calls:

1. **Check Metrics Endpoint Again**:

   ```bash
   curl http://localhost:3002/metrics | grep openai_api
   ```

   Should show incremented values for the metrics.

2. **Verify in Prometheus**:
   - Query: `openai_api_requests_total`
   - Should show metrics with labels: `capability`, `operation`, `status`
   - Values should be > 0 after API calls

**Verification Checklist**:

- [ ] Metrics endpoint shows incremented values after API calls
- [ ] Prometheus shows metrics with correct labels
- [ ] Success metrics are recorded (status="success")
- [ ] Token metrics include model label

#### 5.5 Verify Grafana Setup

1. **Access Grafana**: Open `http://localhost:3000` in browser

2. **Login**:

   - Username: `admin`
   - Password: `admin`
   - (Change password on first login if prompted)

3. **Verify Data Source**:

   - Navigate to: **Configuration → Data Sources**
   - Verify **Prometheus** data source exists
   - Click **Prometheus** and verify:
     - URL: `http://prometheus:9090`
     - Status: **Working** (green checkmark)
   - Click **Save & Test**

4. **Create Test Dashboard** (Optional):
   - Navigate to: **Dashboards → New Dashboard**
   - Add panel with query: `rate(openai_api_requests_total[5m])`
   - Verify data appears in the graph

**Verification Checklist**:

- [ ] Grafana UI is accessible
- [ ] Prometheus data source is configured and working
- [ ] Can query metrics in Grafana
- [ ] Dashboard shows data (after API calls)

#### 5.6 Verify Metrics Recording

After making several API calls, verify all metrics are being recorded correctly:

**In Prometheus UI**, verify these queries return data:

1. **Request Count**:

   ```promql
   openai_api_requests_total
   ```

   - Should show metrics with labels: `capability`, `operation`, `status`
   - Both `status="success"` and `status="failure"` should exist (if failures occurred)

2. **Duration Metrics**:

   ```promql
   histogram_quantile(0.95, rate(openai_api_request_duration_ms_bucket[5m]))
   ```

   - Should return P95 duration in milliseconds
   - Should only have `status="success"` (failures don't record duration)

3. **Token Usage**:
   ```promql
   openai_api_tokens_total
   ```
   - Should show metrics with labels: `capability`, `operation`, `type`, `model`
   - Both `type="input"` and `type="output"` should exist
   - Model label should match the model used (e.g., "gpt-4.1-mini")

**Verification Checklist**:

- [ ] Request metrics are recorded with correct labels
- [ ] Duration metrics are recorded only for successes
- [ ] Token metrics include model label
- [ ] All label combinations are present

### Troubleshooting

#### Metrics Endpoint Not Accessible

- Check AI service is running: `docker-compose ps`
- Check logs: `docker-compose logs ai`
- Verify port mapping: `docker-compose port ai 3002`

#### Prometheus Can't Scrape

- Check Prometheus logs: `docker-compose logs prometheus`
- Verify network connectivity: `docker-compose exec prometheus ping ai`
- Check Prometheus config: `docker-compose exec prometheus cat /etc/prometheus/prometheus.yml`

#### No Metrics in Prometheus

- Wait 15 seconds (scrape interval)
- Check target status in Prometheus UI
- Verify metrics endpoint returns data: `curl http://localhost:3002/metrics`

#### Grafana Can't Connect to Prometheus

- Check Prometheus is running: `docker-compose ps prometheus`
- Verify data source URL: `http://prometheus:9090`
- Check network: Both services should be on same Docker network

### Files Verified

- `backend/services/ai/src/routers/metrics-router.ts` - Metrics endpoint handler
- `backend/services/ai/src/metrics/openai-metrics.ts` - Metrics definitions
- `backend/services/ai/src/clients/openai/openai.ts` - Metrics instrumentation
- `prometheus/prometheus.yml` - Prometheus configuration
- `grafana/provisioning/datasources/prometheus.yml` - Grafana data source

### Next Steps

Implementation is complete! You can now:

1. **Create Grafana Dashboards**: Build custom dashboards for monitoring
2. **Set Up Alerts**: Configure Prometheus alerting rules (see plan document)
3. **Monitor in Production**: Ensure metrics endpoint security before deploying

---

## Implementation Summary

All parts of the OpenAI API Monitoring implementation are now complete:

✅ **Part 1**: Infrastructure Setup (Docker Compose, Prometheus, Grafana)  
✅ **Part 2**: Code Setup (Dependencies, TypeScript config, Metrics module)  
✅ **Part 3**: Metrics Router Integration  
✅ **Part 4**: Instrument executeParse function  
✅ **Part 5**: Testing and Verification

The monitoring system is ready for use!
