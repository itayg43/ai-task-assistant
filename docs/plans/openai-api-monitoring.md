# OpenAI API Monitoring with Prometheus and Grafana

## Overview

Implement monitoring for OpenAI API request performance using Prometheus (time-series database) and Grafana (visualization dashboard) for local development. This provides Datadog-like observability with request counts, success rates, duration percentiles (P50, P95, P99), and token usage tracking.

## Architecture

```
┌─────────────┐
│ AI Service  │
│ Port 3002   │
│             │
│ /metrics    │──┐
└─────────────┘  │
                 │ Scrapes every 15s
                 ▼
         ┌───────────────┐
         │  Prometheus   │
         │  Port 9090    │
         │  (TSDB)       │
         └───────────────┘
                 │
                 │ Queries
                 ▼
         ┌───────────────┐
         │   Grafana     │
         │   Port 3000   │
         │  (Dashboard)  │
         └───────────────┘
```

## Implementation Steps

### 1. Infrastructure Setup

#### 1.1 Add Prometheus Service to Docker Compose

**File: `docker-compose.yml`**

```yaml
services:
  # ... existing services ...

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
    restart: unless-stopped
    networks:
      - default

volumes:
  # ... existing volumes ...
  prometheus_data:
```

**File: `docker-compose.dev.yml`**

```yaml
services:
  prometheus:
    ports:
      - "9090:9090"
    # Same config as base docker-compose.yml
```

#### 1.2 Add Grafana Service to Docker Compose

**File: `docker-compose.yml`**

```yaml
services:
  # ... existing services ...

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    restart: unless-stopped
    depends_on:
      - prometheus
    networks:
      - default

volumes:
  # ... existing volumes ...
  grafana_data:
```

#### 1.3 Create Prometheus Configuration

**File: `prometheus/prometheus.yml`**

```yaml
global:
  scrape_interval: 15s # How often to scrape metrics
  evaluation_interval: 15s
  external_labels:
    monitor: "ai-task-assistant"

scrape_configs:
  - job_name: "ai-service"
    static_configs:
      - targets: ["ai:3002"]
        labels:
          service: "ai"
          environment: "development"
    metrics_path: "/metrics"
    scrape_interval: 15s
    scrape_timeout: 10s
```

#### 1.4 Create Grafana Data Source Provisioning (Optional)

**File: `grafana/provisioning/datasources/prometheus.yml`**

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
```

### 2. Code Implementation

#### 2.1 Install Dependencies

**File: `backend/services/ai/package.json`**

```json
{
  "dependencies": {
    // ... existing dependencies ...
    "prom-client": "^15.1.0"
  }
}
```

Run: `npm install` in `backend/services/ai/`

#### 2.2 Create Metrics Module

**File: `backend/services/ai/src/metrics/openai-metrics.ts`**

```typescript
import { Counter, Histogram, Registry } from "prom-client";

// Create a metrics registry
export const register = new Registry();

// Counter for total API requests
// Tracks success and failure counts to calculate success rate
// Labels: capability (e.g., "parse-task"), operation (e.g., "core", "subtasks"), status ("success" | "failure")
export const openaiApiRequestsTotal = new Counter({
  name: "openai_api_requests_total",
  help: "Total number of OpenAI API requests",
  labelNames: ["capability", "operation", "status"],
  registers: [register],
});

// Histogram for request duration (automatically calculates percentiles)
// Tracks average and P95 duration (P99 can be calculated if needed)
// Labels: capability, operation, status
// Buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000] milliseconds
// P95 is the primary percentile tracked for performance monitoring
export const openaiApiRequestDurationMs = new Histogram({
  name: "openai_api_request_duration_ms",
  help: "Duration of OpenAI API requests in milliseconds",
  labelNames: ["capability", "operation", "status"],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
});

// Counter for total token usage
// Tracks total tokens consumed (not average - average can be derived)
// Useful for cost tracking, usage trends, and rate calculations
// Labels: capability, operation, type ("input" | "output")
// Note: Average tokens per request can be calculated as:
//   sum(rate(openai_api_tokens_total[5m])) / sum(rate(openai_api_requests_total[5m]))
export const openaiApiTokensTotal = new Counter({
  name: "openai_api_tokens_total",
  help: "Total tokens used in OpenAI API requests",
  labelNames: ["capability", "operation", "type"],
  registers: [register],
});
```

**File: `backend/services/ai/src/metrics/index.ts`**

```typescript
export { register } from "./openai-metrics";
export {
  openaiApiRequestsTotal,
  openaiApiRequestDurationMs,
  openaiApiTokensTotal,
} from "./openai-metrics";
```

#### 2.3 Add Metrics Endpoint

**File: `backend/services/ai/src/app.ts`**

```typescript
import express from "express";
// ... existing imports ...
import { register } from "@metrics";

export const app = express();

// ... existing middleware ...

// Metrics endpoint (no auth required, Prometheus will scrape it)
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

// ... existing routes ...
```

#### 2.4 Instrument executeParse Function

**File: `backend/services/ai/src/clients/openai/openai.ts`**

```typescript
import OpenAI from "openai";
// ... existing imports ...
import {
  openaiApiRequestsTotal,
  openaiApiRequestDurationMs,
  openaiApiTokensTotal,
} from "@metrics/openai-metrics";

// ... existing code ...

export const executeParse = async <TOutput>(
  capability: Capability,
  operation: string,
  input: string,
  prompt: ResponseCreateParamsNonStreaming,
  promptVersion: string,
  requestId: string
) => {
  const baseLogContext = {
    requestId,
    capability,
    operation,
    input,
    promptVersion,
  };

  // Prepare labels for metrics (like tags in Datadog)
  const labels = {
    capability,
    operation,
  };
  let status: "success" | "failure" = "success";
  let durationMs: number = 0;

  let openaiResponseId: string | undefined;

  try {
    logger.info("executeParse - start", baseLogContext);

    const response = await withDurationAsync(() =>
      openai.responses.parse<any, TOutput>(prompt)
    );

    openaiResponseId = response.result.id;
    durationMs = response.durationMs;

    if (response.result.status !== "completed") {
      throw new InternalError("OpenAI returned an uncompleted response.");
    }

    if (!response.result.output_parsed) {
      throw new InternalError("OpenAI failed to parse the output correctly.");
    }

    const result = {
      openaiResponseId,
      output: response.result.output_parsed,
      usage: {
        tokens: {
          input: response.result.usage?.input_tokens || 0,
          output: response.result.usage?.output_tokens || 0,
        },
      },
      durationMs: response.durationMs,
    };

    // ✅ RECORD SUCCESS METRICS
    status = "success";
    openaiApiRequestsTotal.inc({ ...labels, status });
    openaiApiRequestDurationMs.observe({ ...labels, status }, durationMs);
    openaiApiTokensTotal.inc(
      { ...labels, type: "input" },
      result.usage.tokens.input
    );
    openaiApiTokensTotal.inc(
      { ...labels, type: "output" },
      result.usage.tokens.output
    );

    logger.info("executeParse - succeeded", {
      ...baseLogContext,
      result,
    });

    return result;
  } catch (error) {
    // ✅ RECORD FAILURE METRICS
    status = "failure";
    openaiApiRequestsTotal.inc({ ...labels, status });

    // Record duration if we have it (error happened after API call)
    // For network errors, duration might be 0 or unavailable
    if (durationMs > 0) {
      openaiApiRequestDurationMs.observe({ ...labels, status }, durationMs);
    }

    if (error instanceof OpenAI.APIError) {
      const openaiRequestId = error.requestID;

      logger.error("executeParse - failed", error, {
        ...baseLogContext,
        openaiRequestId,
        openaiErrorMessage: error.error?.message,
        openaiErrorStatusCode: error.status,
      });

      throw new InternalError(CAPABILITY_EXECUTION_ERROR_MESSAGE, {
        openaiRequestId,
        type: AI_ERROR_TYPE.OPENAI_API_ERROR,
      });
    }

    logger.error("executeParse - failed", error, {
      ...baseLogContext,
      openaiResponseId,
    });

    throw new InternalError(CAPABILITY_EXECUTION_ERROR_MESSAGE, {
      openaiResponseId,
    });
  }
};
```

### 3. Grafana Dashboard Setup

#### 3.1 Access Grafana

1. Start services: `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up`
2. Open browser: `http://localhost:3000`
3. Login: `admin` / `admin` (change password on first login)

#### 3.2 Configure Prometheus Data Source

If not auto-provisioned:

1. Go to Configuration → Data Sources
2. Add Prometheus data source
3. URL: `http://prometheus:9090`
4. Save & Test

#### 3.3 Create Dashboard Panels

Create a new dashboard with the following panels:

**Panel 1: Request Volume**

- **Title**: OpenAI API Requests per Second
- **Query**: `rate(openai_api_requests_total[5m])`
- **Visualization**: Time series
- **Legend**: `{{capability}} - {{operation}} - {{status}}`

**Panel 2: Success Rate**

- **Title**: Success Rate (%)
- **Query**:
  ```promql
  sum(rate(openai_api_requests_total{status="success"}[5m]))
  /
  sum(rate(openai_api_requests_total[5m]))
  * 100
  ```
- **Visualization**: Stat
- **Unit**: Percent (0-100)

**Panel 3: Duration Metrics**

- **Title**: Request Duration (ms)
- **Queries**:
  - Average: `avg(rate(openai_api_request_duration_ms_sum[5m]) / rate(openai_api_request_duration_ms_count[5m]))`
  - P95: `histogram_quantile(0.95, rate(openai_api_request_duration_ms_bucket[5m]))`
  - (Optional) P99: `histogram_quantile(0.99, rate(openai_api_request_duration_ms_bucket[5m]))`
- **Visualization**: Time series
- **Legend**: `{{capability}} - {{operation}}`
- **Note**: P95 is the primary percentile for performance monitoring. P99 can be added if tail latency analysis is needed.

**Panel 4: Error Rate**

- **Title**: Error Rate (requests/sec)
- **Query**: `sum(rate(openai_api_requests_total{status="failure"}[5m]))`
- **Visualization**: Time series

**Panel 5: Token Usage**

- **Title**: Token Usage per Second
- **Query**: `rate(openai_api_tokens_total[5m])`
- **Visualization**: Time series
- **Legend**: `{{capability}} - {{operation}} - {{type}}`
- **Note**: Tracks total token consumption. Average tokens per request can be calculated as:
  `sum(rate(openai_api_tokens_total[5m])) / sum(rate(openai_api_requests_total[5m]))`

**Panel 6: Total Requests (Counter)**

- **Title**: Total Requests
- **Query**: `sum(increase(openai_api_requests_total[1h]))`
- **Visualization**: Stat
- **Unit**: Short

### 4. Testing

#### 4.1 Verify Metrics Endpoint

```bash
# Check if metrics endpoint is accessible
curl http://localhost:3002/metrics

# Should return Prometheus format metrics
```

#### 4.2 Verify Prometheus Scraping

1. Open Prometheus UI: `http://localhost:9090`
2. Go to Status → Targets
3. Verify `ai-service` target is "UP"
4. Go to Graph, try query: `openai_api_requests_total`

#### 4.3 Verify Grafana Dashboard

1. Make some API calls to generate metrics
2. Check Grafana dashboard updates in real-time
3. Verify all panels show data

### 5. File Structure

```
.
├── docker-compose.yml          # Add prometheus & grafana services
├── docker-compose.dev.yml      # Add prometheus & grafana ports
├── prometheus/
│   └── prometheus.yml          # Prometheus configuration
├── grafana/
│   └── provisioning/
│       └── datasources/
│           └── prometheus.yml  # Auto-configure Prometheus data source
└── backend/
    └── services/
        └── ai/
            ├── package.json    # Add prom-client dependency
            └── src/
                ├── app.ts      # Add /metrics endpoint
                ├── metrics/
                │   ├── openai-metrics.ts
                │   └── index.ts
                └── clients/
                    └── openai/
                        └── openai.ts  # Instrument executeParse
```

## Metrics Decisions

### What We Track and Why

1. **Success Rate**

   - **Metric**: `openai_api_requests_total` (Counter) with `status` label
   - **Why**: Essential for monitoring API health and reliability
   - **Calculation**: `sum(rate(requests{status="success"})) / sum(rate(requests)) * 100`

2. **Duration Metrics**

   - **Metric**: `openai_api_request_duration_ms` (Histogram)
   - **Primary Focus**: Average and P95 duration
   - **Why P95**: Catches most performance issues without being overly sensitive to outliers. P99 can be added later if tail latency analysis is needed.
   - **Provides**: Average, P50, P95, P99 (all available, but P95 is the focus)

3. **Token Usage**
   - **Metric**: `openai_api_tokens_total` (Counter) - tracks total tokens, not average
   - **Why Total**:
     - Directly relates to cost tracking
     - Enables rate calculations (tokens/second)
     - Average can be derived: `sum(rate(tokens)) / sum(rate(requests))`
     - Simpler to maintain (one metric type)
   - **What It Tells You**:
     - Total consumption over time
     - Token usage rate
     - Input vs output ratio (cost analysis)
     - Usage trends

## Metrics Details

### Metric Types

1. **Counter** (`openai_api_requests_total`, `openai_api_tokens_total`)

   - Only increases (never decreases)
   - Use `rate()` or `increase()` in queries
   - Good for: request counts, total tokens

2. **Histogram** (`openai_api_request_duration_ms`)
   - Tracks distribution of values
   - Automatically creates buckets for percentiles
   - Use `histogram_quantile()` for P50, P95, P99
   - Good for: durations, latencies

### Labels (Tags)

- `capability`: The AI capability (e.g., "parse-task")
- `operation`: The specific operation (e.g., "core", "subtasks")
- `status`: Request outcome ("success" | "failure")
- `type`: Token type ("input" | "output")

### Common Queries

**Request Rate:**

```promql
rate(openai_api_requests_total[5m])
```

**Success Rate:**

```promql
sum(rate(openai_api_requests_total{status="success"}[5m]))
/
sum(rate(openai_api_requests_total[5m]))
* 100
```

**Average Duration:**

```promql
avg(rate(openai_api_request_duration_ms_sum[5m]) / rate(openai_api_request_duration_ms_count[5m]))
```

**P95 Duration:**

```promql
histogram_quantile(0.95,
  rate(openai_api_request_duration_ms_bucket[5m])
)
```

**Token Usage Rate:**

```promql
rate(openai_api_tokens_total[5m])
```

**Average Tokens per Request (Derived):**

```promql
sum(rate(openai_api_tokens_total[5m])) / sum(rate(openai_api_requests_total[5m]))
```

## Notes

- Prometheus scrapes metrics every 15 seconds (configurable)
- Metrics are stored in Prometheus's time-series database (persisted to Docker volume)
- Grafana queries Prometheus for visualization
- All services run locally, no external dependencies
- Metrics data persists in Docker volumes
- Dashboard can be customized further based on needs
- For production, consider adding authentication to `/metrics` endpoint

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [prom-client Documentation](https://github.com/siimon/prom-client)
