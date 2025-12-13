# Log Aggregation with Loki, Promtail, and Grafana

## Overview

Implement centralized log aggregation and visualization using Loki (log aggregation system), Promtail (log shipper), and Grafana (visualization dashboard) for local development. This provides Datadog-like log observability with structured log search, filtering, correlation with metrics, and log-based alerting.

## Architecture

```
┌─────────────┐
│ AI Service  │
│ Port 3002   │
│             │
│ (stdout)    │──┐
└─────────────┘  │
                 │
┌─────────────┐  │
│Tasks Service│  │
│ Port 3001   │  │
│             │  │
│ (stdout)    │──┤
└─────────────┘  │
                 │ Docker logs
                 ▼
         ┌───────────────┐
         │   Promtail    │
         │  (Log Shipper)│
         │               │
         │ Scrapes Docker│
         │ container logs│
         └───────────────┘
                 │
                 │ Pushes logs
                 ▼
         ┌───────────────┐
         │     Loki      │
         │  Port 3100    │
         │  (Log Store)  │
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

#### 1.1 Add Loki Service to Docker Compose

**File: `docker-compose.yml`**

```yaml
services:
  # ... existing services ...

  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - "3100:3100"
    volumes:
      - ./loki/loki-config.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped
    networks:
      - default

volumes:
  # ... existing volumes ...
  loki_data:
```

**File: `docker-compose.dev.yml`**

```yaml
services:
  loki:
    ports:
      - "3100:3100"
    # Same config as base docker-compose.yml
```

#### 1.2 Add Promtail Service to Docker Compose

**File: `docker-compose.yml`**

```yaml
services:
  # ... existing services ...

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - ./promtail/promtail-config.yml:/etc/promtail/config.yml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: -config.file=/etc/promtail/config.yml
    restart: unless-stopped
    depends_on:
      - loki
    networks:
      - default
```

**Note**: On macOS with Docker Desktop, the Docker socket path may differ. See section 1.4 for macOS-specific configuration.

#### 1.3 Create Loki Configuration

**File: `loki/loki-config.yml`**

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093

# Limits configuration
limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h # 7 days
  ingestion_rate_mb: 16
  ingestion_burst_size_mb: 32
  max_query_length: 0
  max_query_parallelism: 32
  max_streams_per_user: 10000
  max_line_size: 256KB
  max_query_series: 500
```

#### 1.4 Create Promtail Configuration

**File: `promtail/promtail-config.yml`**

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Scrape logs from Docker containers
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      # Only scrape containers with specific labels or names
      - source_labels: ["__meta_docker_container_name"]
        regex: "/(ai|tasks|redis|postgres).*"
        action: keep

      # Extract service name from container name
      - source_labels: ["__meta_docker_container_name"]
        regex: "/([^/]+)"
        target_label: "service"

      # Extract container ID
      - source_labels: ["__meta_docker_container_id"]
        target_label: "container_id"

      # Set log path
      - source_labels: ["__meta_docker_container_id"]
        regex: "(.+)"
        target_label: "__path__"
        replacement: "/var/lib/docker/containers/$1/*-json.log"
```

**Note for macOS/Docker Desktop**: Docker Desktop on macOS uses a VM, so the log paths differ. Use this alternative configuration:

**File: `promtail/promtail-config-macos.yml`** (Alternative for macOS)

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Scrape logs from Docker containers using Docker API
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      # Only scrape containers with specific names
      - source_labels: ["__meta_docker_container_name"]
        regex: "/(ai|tasks|redis|postgres).*"
        action: keep

      # Extract service name from container name
      - source_labels: ["__meta_docker_container_name"]
        regex: "/([^/]+)"
        target_label: "service"

      # Extract container ID
      - source_labels: ["__meta_docker_container_id"]
        target_label: "container_id"

      # Use Docker API to read logs
      - source_labels: ["__meta_docker_container_id"]
        target_label: "__path__"
        replacement: "/var/lib/docker/containers/$1/$1-json.log"
```

**Alternative: Direct Log Streaming (Recommended for macOS)**

If Docker log file access is problematic on macOS, you can configure services to output JSON logs directly:

**File: `promtail/promtail-config-direct.yml`** (Direct streaming)

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Scrape from stdout/stderr of containers
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: docker-logs
          __path__: /var/lib/docker/containers/*/*-json.log
    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs: attrs
      - labels:
          stream:
      - json:
          expressions:
            tag: attrs.tag
            level: attrs.level
            service: attrs.service
          source: attrs
      - output:
          source: output
```

#### 1.5 Update Grafana Data Source Provisioning

**File: `grafana/provisioning/datasources/loki.yml`**

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: true
    jsonData:
      maxLines: 1000
```

**Note**: Update `grafana/provisioning/datasources/prometheus.yml` to ensure both Prometheus and Loki are configured.

### 2. Code Implementation

#### 2.1 Update Logger to Output JSON Format (Optional but Recommended)

For better log parsing and structured search, update the logger to output JSON format when running in Docker:

**File: `backend/shared/src/config/create-logger.ts`**

```typescript
import { LoggerLogContext, LoggerLogLevel } from "../types";
import { getDateISO } from "../utils/date-time";
import { exhaustiveSwitch } from "../utils/exhaustive-switch";

const LOG_FORMAT = process.env.LOG_FORMAT || "text"; // "text" | "json"

export const createLogger = (tag: string) => ({
  info: (message: string, context?: LoggerLogContext) =>
    log("info", tag, message, context),
  error: (message: string, error: unknown, context?: LoggerLogContext) =>
    log("error", tag, message, context, error),
  warn: (message: string, context?: LoggerLogContext) =>
    log("warn", tag, message, context),
});

function log(
  level: LoggerLogLevel,
  tag: string,
  message: string,
  context?: LoggerLogContext,
  error?: unknown
) {
  if (LOG_FORMAT === "json") {
    const logEntry = {
      timestamp: getDateISO(),
      level: level.toUpperCase(),
      tag,
      message,
      ...(context && { context }),
      ...(error && { error: serializeError(error) }),
    };
    const output = JSON.stringify(logEntry);
    exhaustiveSwitch(level, {
      info: () => console.log(output),
      error: () => console.error(output),
      warn: () => console.warn(output),
    });
  } else {
    // Existing text format
    const base = `[${getDateISO()}] [${level.toUpperCase()}] [${tag}]: ${message}`;
    let args: unknown[] = [];
    if (error) {
      args.push(serializeError(error));
    }
    if (context) {
      args.push(JSON.stringify(context, null, 2));
    }
    exhaustiveSwitch(level, {
      info: () => console.log(base, ...args),
      error: () => console.error(base, ...args),
      warn: () => console.warn(base, ...args),
    });
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }
  return String(error);
}
```

**File: `docker-compose.yml`** (Add environment variable)

```yaml
services:
  ai:
    build:
      context: ./backend
    environment:
      - LOG_FORMAT=json
    # ... rest of config

  tasks:
    build:
      context: ./backend
    environment:
      - LOG_FORMAT=json
    # ... rest of config
```

#### 2.2 Configure Docker Logging Driver (Alternative)

Instead of modifying code, you can configure Docker to output JSON logs:

**File: `docker-compose.yml`**

```yaml
services:
  ai:
    build:
      context: ./backend
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=ai"
    # ... rest of config

  tasks:
    build:
      context: ./backend
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=tasks"
    # ... rest of config
```

### 3. Grafana Dashboard Setup

#### 3.1 Access Grafana

1. Start services: `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up`
2. Open browser: `http://localhost:3000`
3. Login: `admin` / `admin` (change password on first login)

#### 3.2 Configure Loki Data Source

If not auto-provisioned:

1. Go to Configuration → Data Sources
2. Add Loki data source
3. URL: `http://loki:3100`
4. Save & Test

#### 3.3 Create Log Exploration Dashboard

**Panel 1: Log Browser**

- **Title**: Application Logs
- **Query**: `{service=~"ai|tasks"}`
- **Visualization**: Logs
- **Features**:
  - Filter by service: `{service="ai"}` or `{service="tasks"}`
  - Filter by level: `{service=~"ai|tasks"} |= "ERROR"` or `|= "WARN"`
  - Search text: `{service=~"ai|tasks"} |= "requestId"`
  - Time range selector

**Panel 2: Error Logs**

- **Title**: Error Logs (Last 1 Hour)
- **Query**: `{service=~"ai|tasks"} |= "ERROR"`
- **Visualization**: Logs
- **Time Range**: Last 1 hour

**Panel 3: Request Logs**

- **Title**: Request Logs
- **Query**: `{service=~"ai|tasks"} |= "Request"`
- **Visualization**: Logs
- **Features**: Filter by requestId, statusCode, duration

**Panel 4: Log Volume Over Time**

- **Title**: Log Volume by Service
- **Query**: `sum(count_over_time({service=~"ai|tasks"}[1m])) by (service)`
- **Visualization**: Time series
- **Legend**: `{{service}}`

**Panel 5: Error Rate**

- **Title**: Error Rate (logs/min)
- **Query**: `sum(rate({service=~"ai|tasks"} |= "ERROR" [1m])) by (service)`
- **Visualization**: Time series
- **Legend**: `{{service}}`

**Panel 6: Log Level Distribution**

- **Title**: Logs by Level
- **Query**: `sum(count_over_time({service=~"ai|tasks"} | regexp "(?i)(ERROR|WARN|INFO)" [5m])) by (level)`
- **Visualization**: Pie chart or Bar chart

### 4. LogQL Queries (Loki Query Language)

#### Common Queries

**All logs from a service:**

```logql
{service="ai"}
```

**Error logs:**

```logql
{service=~"ai|tasks"} |= "ERROR"
```

**Logs containing specific text:**

```logql
{service="ai"} |= "requestId"
```

**Logs matching regex:**

```logql
{service="tasks"} |~ "statusCode.*5[0-9]{2}"
```

**Logs with JSON parsing:**

```logql
{service="ai"} | json | level="ERROR"
```

**Log volume over time:**

```logql
sum(count_over_time({service=~"ai|tasks"}[1m])) by (service)
```

**Error rate:**

```logql
sum(rate({service=~"ai|tasks"} |= "ERROR" [5m])) by (service)
```

**Filter by requestId:**

```logql
{service="tasks"} |= "requestId" | json | requestId="abc-123"
```

**Logs with duration > 1000ms:**

```logql
{service="tasks"} | json | durationMs > 1000
```

### 5. Correlation with Metrics

Since you're using both Prometheus (metrics) and Loki (logs), you can correlate them in Grafana:

1. **Create a dashboard with both metrics and logs**
2. **Use variables** to filter both by service, requestId, etc.
3. **Link panels** - click on a metric spike to jump to logs from that time period
4. **Use Explore view** to query both data sources simultaneously

**Example: Correlate API errors with log errors**

- **Metrics Panel**: `rate(openai_api_requests_total{status="failure"}[5m])`
- **Logs Panel**: `{service="ai"} |= "ERROR"` (same time range)

### 6. Testing

#### 6.1 Verify Loki is Running

```bash
# Check Loki health
curl http://localhost:3100/ready

# Check Loki metrics
curl http://localhost:3100/metrics
```

#### 6.2 Verify Promtail is Scraping

1. Open Prometheus UI: `http://localhost:9090` (if Prometheus is configured to scrape Promtail)
2. Or check Promtail logs: `docker logs promtail`

#### 6.3 Verify Logs in Grafana

1. Open Grafana: `http://localhost:3000`
2. Go to Explore → Select Loki data source
3. Run query: `{service=~"ai|tasks"}`
4. Generate some logs by making API calls
5. Verify logs appear in Grafana

### 7. File Structure

```
.
├── docker-compose.yml          # Add loki & promtail services
├── docker-compose.dev.yml      # Add loki port
├── loki/
│   └── loki-config.yml         # Loki configuration
├── promtail/
│   └── promtail-config.yml     # Promtail configuration
├── grafana/
│   └── provisioning/
│       └── datasources/
│           ├── prometheus.yml  # Existing Prometheus data source
│           └── loki.yml        # New Loki data source
└── backend/
    └── shared/
        └── src/
            └── config/
                └── create-logger.ts  # Optional: Add JSON format support
```

## Log Format Decisions

### Structured vs Unstructured Logs

1. **Text Format (Current)**

   - Simple, human-readable
   - Easy to parse with regex in LogQL
   - Works well with existing logger

2. **JSON Format (Recommended)**
   - Better structured search
   - Easier filtering by fields (level, tag, requestId)
   - Better integration with Grafana
   - Can be enabled via `LOG_FORMAT=json` environment variable

### Log Labels

Promtail automatically adds labels from Docker metadata:

- `service`: Extracted from container name
- `container_id`: Docker container ID
- `job`: Set to "docker" or custom job name

Additional labels can be extracted from log content using Promtail's pipeline stages.

## Advanced Features

### 1. Log Retention

Configure retention in `loki-config.yml`:

```yaml
limits_config:
  reject_old_samples_max_age: 168h # 7 days (adjust as needed)
```

### 2. Log Parsing with Pipeline Stages

Extract structured fields from text logs:

**File: `promtail/promtail-config.yml`** (Add pipeline stages)

```yaml
scrape_configs:
  - job_name: docker
    # ... existing config ...
    pipeline_stages:
      # Parse timestamp, level, tag, message
      - regex:
          expression: '\[(?P<timestamp>[^\]]+)\] \[(?P<level>[^\]]+)\] \[(?P<tag>[^\]]+)\]: (?P<message>.*)'
      # Extract JSON context if present
      - json:
          expressions:
            context: context
          source: message
      # Add labels
      - labels:
          level:
          tag:
```

### 3. Alerting on Logs

Create alert rules in Grafana:

1. Go to Alerting → Alert rules
2. Create rule based on LogQL query
3. Example: Alert when error rate > 10 errors/min

**Example Alert Rule:**

```logql
sum(rate({service=~"ai|tasks"} |= "ERROR" [5m])) by (service) > 10
```

### 4. Log Sampling (High Volume)

If log volume is too high, configure sampling in Promtail:

```yaml
pipeline_stages:
  - drop:
      expression: ".*"
      drop_counter_reason: "sampling"
      percentage: 90 # Keep 10% of logs
```

## Notes

- Loki stores logs in a compressed format, making it efficient for local development
- Logs are indexed by labels (service, level, etc.) for fast queries
- Text search uses full-text indexing (slower but more flexible)
- Grafana can visualize both metrics (Prometheus) and logs (Loki) in the same dashboard
- All services run locally, no external dependencies
- Log data persists in Docker volumes
- For production, consider adding authentication and log retention policies
- Loki uses a pull model (Promtail pushes), similar to how Prometheus scrapes metrics

## Comparison with Other Solutions

### Loki vs ELK Stack

**Loki Advantages:**

- Lighter weight (smaller resource footprint)
- Better integration with Grafana (if already using it)
- Simpler setup for local development
- Similar architecture to Prometheus (consistent patterns)

**ELK Stack Advantages:**

- More mature ecosystem
- Better for complex log transformations (Logstash)
- More powerful search (Elasticsearch)
- Better for very high volume (enterprise scale)

### Loki vs Datadog

**Loki Advantages:**

- Free and open-source
- Self-hosted (no external dependencies)
- Full control over data
- No vendor lock-in

**Datadog Advantages:**

- Managed service (no infrastructure to maintain)
- Built-in integrations
- Advanced analytics and ML features
- Better for production at scale

## References

- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Promtail Documentation](https://grafana.com/docs/loki/latest/clients/promtail/)
- [LogQL Documentation](https://grafana.com/docs/loki/latest/logql/)
- [Grafana Logs Documentation](https://grafana.com/docs/grafana/latest/explore/logs-integration/)
- [Docker Logging Drivers](https://docs.docker.com/config/containers/logging/)
