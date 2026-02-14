# Project Status

**Last Updated:** 2026-02-11
**Current Branch:** `feature/itaygur/execute-capabilities-async`

---

## Current Work

### Status: 🟡 Code Review - Quality Improvements Needed

Async AI processing implementation is complete. Found 15 code quality issues during comprehensive review. Fixing high/medium priority items before merge to main.

---

## Code Quality Issues (Pre-Merge)

### 🔴 HIGH Priority (Must Fix Before Merge)

#### 1. Nested Fire-and-Forget with Unhandled Rejections
- **Location:** `backend/services/tasks/src/utils/reconcile-tokens-if-possible/reconcile-tokens-if-possible.ts` (lines 27-37)
- **Issue:** Double-nested fire-and-forget pattern with `.then()` chaining creates potential for silent failures
- **Impact:** Silent metadata cleanup failures could cause Redis memory bloat over time
- **Status:** 🔲 Not started

#### 2. Unchecked Non-Null Assertion in Transaction
- **Location:** `backend/services/tasks/src/services/webhooks-service/webhooks-service.ts` (line 18)
- **Issue:** `return taskWithSubtasks!` without validation
- **Impact:** Potential runtime crash if concurrent task deletion occurs during webhook processing
- **Status:** 🔲 Not started

#### 3. Untyped Generic in OpenAI Client
- **Location:** `backend/services/ai/src/clients/openai/openai.ts` (line 15)
- **Issue:** `<any, TOutput>` type parameter exposes untyped input
- **Impact:** Loss of type safety for OpenAI API calls
- **Status:** 🔲 Not started

---

### 🟡 MEDIUM Priority (Should Fix Before Merge)

#### 4. DRY Violation: Duplicated Token Reconciliation Pattern
- **Location:**
  - `webhooks-controller.ts` (lines 54, 64, 97, 113) - 4 identical calls
  - `tasks-controller.ts` (line 90) - 1 call with different function
- **Issue:** Token reconciliation called 5 times with inconsistent patterns and error handling
- **Impact:** Harder to maintain, inconsistent retry/error behavior
- **Status:** 🔲 Not started

#### 5. Missing Metadata Expiration Metric
- **Location:** `backend/services/tasks/src/utils/reconcile-tokens-if-possible/reconcile-tokens-if-possible.ts` (line 39)
- **Issue:** TODO comment indicates documented but unimplemented metric for tracking when metadata expires before webhook callback
- **Impact:** No visibility into token leakage, cannot determine if webhook latency is a problem
- **Status:** 🔲 Not started

#### 6. Untyped `any` in Prompt Injection Validation
- **Location:** `backend/services/ai/src/middlewares/validate-prompt-injection/validate-prompt-injection.ts` (line 25)
- **Issue:** Helper function uses untyped `any` for nested object traversal
- **Impact:** No type safety for validation logic
- **Status:** 🔲 Not started

#### 7. Hardcoded Service URLs in Business Logic
- **Location:** `backend/services/tasks/src/services/tasks-service/tasks-service.ts` (line 16)
- **Issue:** Callback URL hardcoded with service hostname and port
- **Impact:** Brittle inter-service communication, breaks if deployment changes
- **Status:** 🔲 Not started

---

### 🟢 LOW Priority (Nice to Have)

#### 8. Magic Numbers in Metrics Histogram Buckets
- **Location:** `backend/services/tasks/src/metrics/tasks-metrics.ts` (line 26)
- **Issue:** Hardcoded values lack semantic meaning
- **Status:** 🔲 Not started

#### 9. Inconsistent Metadata Cleanup Error Handling
- **Location:** `backend/services/tasks/src/services/token-usage-service/request-metadata.ts` (lines 35-41, 64-70, 78-90)
- **Issue:** All operations silently log errors but don't propagate them
- **Status:** 🔲 Not started

#### 10. Test Coverage Gap: Metadata Cleanup Errors
- **Location:** `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`
- **Issue:** No tests for failure scenarios in `deleteRequestMetadata()`
- **Status:** 🔲 Not started

#### 11. Race Condition Documentation Gap
- **Location:** `backend/shared/src/utils/token-bucket/process-token-bucket/process-token-bucket.ts` (lines 42-45)
- **Issue:** Comment explains lock protection, but no corresponding comment at middleware level
- **Status:** 🔲 Not started

#### 12. Inconsistent Logger Usage
- **Issue:** Some modules use logger consistently, others don't
- **Status:** 🔲 Not started

#### 13-15. Minor Type Safety & Pattern Issues
- Various minor improvements across the codebase
- **Status:** 🔲 Not started

---

## Infrastructure Issues

### ✅ Docker Compose Healthcheck Improvements (COMPLETED)

#### 1. Prisma Migrations Fail on First Run (FIXED)
- **Issue:** Tasks service attempted to run Prisma migrations before PostgreSQL was fully ready
- **Error:** `P1001: Can't reach database server at postgres:5432`
- **Fix Applied:**
  - Added healthcheck to PostgreSQL service (5s interval, 5 retries, 10s start period)
  - Updated tasks service `depends_on` with `condition: service_healthy`
- **Tested:** ✅ Verified with complete clean start - migrations run successfully on first attempt
- **Status:** ✅ Fixed

#### 2. RabbitMQ Connection Failures on Startup (FIXED)
- **Issue:** AI services could start before RabbitMQ was ready to accept connections
- **Risk:** Intermittent connection failures, service crashes on first launch
- **Fix Applied:**
  - Added healthcheck to RabbitMQ service (10s interval, 5 retries, 30s start period)
  - Updated ai and ai-consumer `depends_on` with `condition: service_healthy`
- **Tested:** ✅ Both services wait for RabbitMQ health, connections establish immediately
- **Status:** ✅ Fixed

#### 3. Redis Connection Failures on Startup (FIXED)
- **Issue:** Tasks service could start before Redis was ready (rate limiter dependency)
- **Risk:** Failed rate limiter initialization, service startup errors
- **Fix Applied:**
  - Added healthcheck to Redis service (5s interval, 3s timeout, 5 retries)
  - Updated tasks service `depends_on` to use `condition: service_healthy` for Redis
- **Tested:** ✅ Tasks waits for Redis health, connections establish immediately
- **Status:** ✅ Fixed

**Overall Result:** Production-ready startup orchestration with proper dependency health checks. All services start in correct order with zero connection errors on first launch.

---

## Future Changes

### 1. Metadata Expiration Metric
- **Context:** Track when webhook callbacks arrive after 1-hour metadata TTL expires (tokens leak in this edge case)
- **Enhancement:** Add `recordMetadataNotFound()` metric
- **Location:** `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.ts`
- **Impact:** Better visibility into token leakage and webhook latency issues
- **Priority:** Medium
- **Status:** 🔲 Planned (overlaps with code quality issue #5)

### 2. Multi-Tenant Architecture
- **Data Model:**
  - `Account`: Represents organization/workspace
  - `User`: Team members within an account (role: owner, admin, member)
  - `Task`, `Subtask`: Automatically scoped by `accountId`
- **Implementation:**
  - Add `accountId` to all data tables
  - Add composite indexes: `(accountId, userId)` for efficient queries
  - Middleware for automatic account context extraction from JWT
  - Query filtering: All queries automatically filtered by `accountId`
- **Security:** Data isolation at query level
- **Priority:** High
- **Status:** 🔲 Planned

### 3. Load Balancing & Horizontal Scaling
- **Nginx Reverse Proxy:**
  - Route requests across multiple service instances
  - Load balancing algorithm: least_conn
  - Health checks for automatic failover
- **Multi-Instance Support:**
  - Docker Compose templating for N service instances
  - Dynamic instance registration with load balancer
  - Shared state via Redis (no instance affinity required)
- **Priority:** Medium
- **Status:** 🔲 Planned

### 4. Semantic Search with Embeddings
- **Context:** Enable finding conceptually similar tasks beyond keyword matching. Users can discover related tasks even when using different terminology, synonyms, or describing concepts differently.
- **Implementation:**
  - **PostgreSQL pgvector Extension:** Add vector column to tasks table for storing embeddings
  - **OpenAI Embeddings API:** Generate embeddings using `text-embedding-3-small` model (~$0.00002/1K tokens)
  - **Schema Changes:**
    - Add `embedding vector(1536)` column to tasks table
    - Add vector similarity index: `CREATE INDEX ON tasks USING ivfflat (embedding vector_cosine_ops)`
    - Generate embeddings on task creation from `title + description`
  - **Query Pattern:**
    ```sql
    SELECT * FROM tasks
    WHERE account_id = $1  -- Maintains data isolation
    ORDER BY embedding <=> $queryVector
    LIMIT 10
    ```
- **Use Cases:**
  - **Team-wide search:** "Find tasks about client meetings" → discovers "Schedule call with stakeholder", "Prepare Q&A for customer sync", "Book conference room for demo"
  - **Cross-user discovery:** Find similar tasks created by teammates (with accountId filtering)
  - **Typo tolerance:** Searches work even with misspellings
  - **Multi-language:** Semantic similarity works across languages
- **Storage Cost:** ~6KB per task embedding (1536 dimensions × 4 bytes)
- **Benefits vs Regular Search:**
  - Regular: Exact keyword matching only (`title ILIKE '%meeting%'`)
  - Semantic: Finds conceptually related tasks regardless of exact wording
- **Priority:** Medium
- **Status:** 🔲 Planned

### 5. Infrastructure Metrics & Observability
- **Context:** Add production-grade infrastructure monitoring for CPU, memory, and HTTP latency metrics across all services (tasks, ai, ai-consumer)
- **Implementation:**
  - **Default Metrics (automatic):** Enable `collectDefaultMetrics()` in shared Prometheus client
    - CPU: `process_cpu_user_seconds_total`, `process_cpu_system_seconds_total`
    - Memory: `process_resident_memory_bytes`, `nodejs_heap_space_size_bytes`, `nodejs_heap_space_used_bytes`
    - Event Loop: `nodejs_eventloop_lag_seconds` (detects blocking operations)
    - GC: `nodejs_gc_duration_seconds` (garbage collection performance)
    - Active Resources: `nodejs_active_handles_total`, `nodejs_active_requests_total`
  - **HTTP Latency Metrics (NEW custom middleware):** Create `httpMetricsMiddleware` (separate from `requestResponseMetadata` logging middleware)
    - **Purpose**: Record Prometheus metrics only (not logging)
    - Metric: `http_request_duration_ms` (histogram with p50, p95, p99 percentiles)
    - Metric: `http_requests_total` (counter by status code)
    - Labels: `service`, `method`, `route`, `status_code`
    - **Parameters**: `serviceName` (string), `skipPaths` (string[], default: `['/metrics']`)
    - **Skip Infrastructure Endpoints**: Exclude `/metrics`, `/health`, `/healthz` from tracking to avoid noise
    - Apply early in middleware chain for all services
  - **Middleware Separation (Single Responsibility):**
    - `httpMetricsMiddleware` (NEW) → Prometheus metrics (histogram, counter)
    - `requestResponseMetadata` (EXISTING) → Logging to stdout (logger.info)
    - Keep separate for independent configuration, easier testing, clearer responsibilities
  - **Expected Latency Patterns:**
    - Tasks service: Fast for 202 endpoints (~50-200ms), moderate for GET/webhooks (~100-800ms)
    - AI service: Consistently fast (~20-100ms, all 202 responses)
    - AI consumer: No HTTP latency (worker), heavy lifting tracked via existing OpenAI metrics
  - **Middleware Order** (app.ts):
    ```
    helmet → cors → json → requestId → httpMetricsMiddleware → requestResponseMetadata → routers → errorHandler
    ```
  - **Usage Example**:
    ```typescript
    app.use(httpMetricsMiddleware("tasks", ["/metrics", "/health"]));
    ```
- **Files to Create:**
  - `backend/shared/src/middlewares/http-metrics-middleware/http-metrics-middleware.ts` (NEW)
  - `backend/shared/src/middlewares/http-metrics-middleware/index.ts` (NEW)
- **Files to Modify:**
  - `backend/shared/src/clients/prom.ts` - Add `collectDefaultMetrics()`
  - `backend/services/tasks/src/app.ts` - Apply middleware
  - `backend/services/ai/src/app.ts` - Apply middleware
- **Grafana Dashboards:**
  - CPU usage: `rate(process_cpu_user_seconds_total[1m]) * 100`
  - Memory (MB): `process_resident_memory_bytes / 1024 / 1024`
  - p95 latency: `histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))`
  - Request rate by status: `sum by (status_code) (rate(http_requests_total[1m]))`
- **Priority:** Medium
- **Status:** 🔲 Planned

### 6. Middleware Refactoring: Top-Level Request Tracking
- **Context:** Currently `requestId` and `requestResponseMetadata` are applied per-router (inside `routers/index.ts`), causing them to run only for specific routes. Move to top-level app middleware for universal coverage.
- **Current Issues:**
  - Request ID not available for all endpoints (health checks, 404s, metrics)
  - Request/response logging only happens for authenticated routes
  - `requestResponseMetadata` tightly coupled to authentication (calls `getAuthenticationContext()` which throws if auth missing)
- **Implementation:**
  - **Move to top-level** (`app.ts`): Apply `requestId` and `requestResponseMetadata` before all routes
  - **Make auth context optional**: Update `requestResponseMetadata` to gracefully handle missing auth context instead of throwing
  - **Add skipPaths parameter**: Similar to `httpMetricsMiddleware`, allow excluding infrastructure endpoints from logging
  - **New middleware order** (app.ts):
    ```
    helmet → cors → json → requestId → httpMetricsMiddleware → requestResponseMetadata → routers → errorHandler
    ```
  - **Router-level middleware** (routers/index.ts): Keep only route-specific middleware (authentication, rate limiting, validation)
  - **Note**: This task is separate from Task #5 (Infrastructure Metrics). Task #5 creates the NEW `httpMetricsMiddleware`, this task refactors the EXISTING `requestResponseMetadata`
- **Benefits:**
  - All requests get request IDs (easier debugging, distributed tracing)
  - All requests logged (including health checks, 404s, unauthenticated endpoints)
  - Separation of concerns (logging ≠ authentication)
  - More flexible (can add public routes without breaking logging)
- **Files to Modify:**
  - `backend/shared/src/middlewares/request-response-metadata/request-reponse-metadata.ts` - Make auth context optional
  - `backend/services/tasks/src/app.ts` - Move `requestId` + `requestResponseMetadata` to top level
  - `backend/services/ai/src/app.ts` - Same as above
  - `backend/services/tasks/src/routers/index.ts` - Remove moved middlewares
  - `backend/services/ai/src/routers/index.ts` - Remove moved middlewares
- **Priority:** Low
- **Status:** 🔲 Planned

---

## Architecture Overview

### Monorepo Structure (npm workspaces)

```
backend/
├── shared/              ✅ Shared utilities, middleware, clients
│   ├── clients/         ✅ Redis, Redlock, RabbitMQ, Prisma
│   ├── middlewares/     ✅ Rate limiting, metrics, validation
│   ├── utils/           ✅ with-retry, with-lock, with-metrics
│   └── types/           ✅ Shared types, error classes
│
├── services/
│   ├── ai/              ✅ AI capabilities service (port 3002)
│   │   ├── controllers/ ✅ Capabilities controller
│   │   ├── consumers/   ✅ RabbitMQ consumer (async processing)
│   │   ├── capabilities/✅ Strategy pattern (parse-task, etc.)
│   │   └── clients/     ✅ OpenAI client
│   │
│   └── tasks/           ✅ Task management service (port 3001)
│       ├── controllers/ ✅ Tasks, webhooks controllers
│       ├── services/    ✅ Tasks, webhooks, token usage services
│       ├── repositories/✅ Prisma data access layer
│       └── prisma/      ✅ Database schema and migrations
```

### Infrastructure (Docker Compose)

```
Services:
├── ai (3002)            ✅ AI service API
├── ai-consumer          ✅ RabbitMQ message consumer
├── tasks (3001)         ✅ Tasks service API
├── postgres (5432)      ✅ PostgreSQL database
├── redis (6379)         ✅ Rate limiting & caching
├── rabbitmq (5672)      ✅ Message queue (async processing)
├── prometheus (9090)    ✅ Metrics collection
└── grafana (3000)       ✅ Metrics visualization
```

---

## Async Processing Flow (Completed)

### Request Path ✅
1. Client → Tasks Service `POST /api/v1/tasks` with natural language
2. Rate limiter reserves tokens, stores metadata in Redis (1-hour TTL)
3. Tasks Service → AI Service `POST /api/v1/capabilities/:capability`
4. AI Service validates input, queues message to RabbitMQ
5. Tasks Service receives `202 Accepted`, returns to client

### Callback Path ✅
1. AI Consumer picks up queued message
2. Consumer calls OpenAI API, receives response with actual token usage
3. Consumer → Tasks Service `POST /api/v1/webhooks/create-task` with result
4. Webhook controller creates DB records (success) or records error metrics
5. Background: Token reconciliation (actual vs reserved) + metrics recording
6. Background: Metadata cleanup from Redis

### Error Handling ✅
- Request-path errors (prompt injection, validation): Reconcile with 0 tokens immediately
- Callback-path errors with OpenAI metadata (vague input): Reconcile with actual tokens
- Callback-path errors without OpenAI metadata (API failures): Reconcile with 0 tokens
- Error transformation at service boundary: AI→Tasks (full context), Tasks→Client (sanitized)

---

## Testing

- ✅ **Framework:** Vitest with globals
- ✅ **Coverage:** 32 tests across unit + integration
- ✅ **Database tests:** Real PostgreSQL with cleanup
- ✅ **Prompt evaluation tests:** Separate opt-in suite
- ✅ **Type checking:** Always run before tests

---

## Key Accomplishments

✅ Async processing with RabbitMQ
✅ Token reconciliation system (all error scenarios)
✅ Distributed locking with Redlock
✅ Comprehensive metrics (Prometheus/Grafana)
✅ Repository pattern with transaction support
✅ Custom error hierarchy with context preservation
✅ Zod validation for all inputs
✅ Path aliases for clean imports
✅ Fire-and-forget pattern with proper testing
✅ Database integration tests with real PostgreSQL
