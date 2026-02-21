# Project Status

**Last Updated:** 2026-02-21
**Current Branch:** `feature/itaygur/execute-capabilities-async`

---

## Code Quality Issues (Pre-Merge)

### 🔴 HIGH Priority (Must Fix Before Merge)

#### 1. Unchecked Non-Null Assertion in Transaction

- **Location:** `backend/services/tasks/src/services/webhooks-service/webhooks-service.ts` (line 18)
- **Issue:** `return taskWithSubtasks!` without validation
- **Impact:** Potential runtime crash if concurrent task deletion occurs during webhook processing
- **Status:** 🔲 Not started

#### 2. Untyped Generic in OpenAI Client

- **Location:** `backend/services/ai/src/clients/openai/openai.ts` (line 15)
- **Issue:** `<any, TOutput>` type parameter exposes untyped input
- **Impact:** Loss of type safety for OpenAI API calls
- **Status:** 🔲 Not started

---

### 🟡 MEDIUM Priority (Should Fix Before Merge)

#### 3. Untyped `any` in Prompt Injection Validation

- **Location:** `backend/services/ai/src/middlewares/validate-prompt-injection/validate-prompt-injection.ts` (line 25)
- **Issue:** Helper function uses untyped `any` for nested object traversal
- **Impact:** No type safety for validation logic
- **Status:** 🔲 Not started

#### 4. Hardcoded Service URLs in Business Logic

- **Location:** `backend/services/tasks/src/services/tasks-service/tasks-service.ts` (line 16)
- **Issue:** Callback URL hardcoded with service hostname and port
- **Impact:** Brittle inter-service communication, breaks if deployment changes
- **Status:** 🔲 Not started

---

### 🟢 LOW Priority (Nice to Have)

#### 5. Magic Numbers in Metrics Histogram Buckets

- **Location:** `backend/services/tasks/src/metrics/tasks-metrics.ts` (line 26)
- **Issue:** Hardcoded values lack semantic meaning
- **Status:** 🔲 Not started

#### 6. Inconsistent Metadata Cleanup Error Handling

- **Location:** `backend/services/tasks/src/services/token-usage-service/request-metadata.ts` (lines 35-41, 64-70, 78-90)
- **Issue:** All operations silently log errors but don't propagate them
- **Status:** 🔲 Not started

#### 7. Test Coverage Gap: Metadata Cleanup Errors

- **Location:** `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`
- **Issue:** No tests for failure scenarios in `deleteRequestMetadata()`
- **Status:** 🔲 Not started

#### 8. Race Condition Documentation Gap

- **Location:** `backend/shared/src/utils/token-bucket/process-token-bucket/process-token-bucket.ts` (lines 42-45)
- **Issue:** Comment explains lock protection, but no corresponding comment at middleware level
- **Status:** 🔲 Not started

#### 9. Inconsistent Logger Usage

- **Issue:** Some modules use logger consistently, others don't
- **Status:** 🔲 Not started

#### 10-12. Minor Type Safety & Pattern Issues

- Various minor improvements across the codebase
- **Status:** 🔲 Not started

---

## Future Changes

### 1. OpenAI Prompt Caching Optimization

- **Context:** Current prompts inject dynamic values (categories, priorities, timestamps) in the middle, breaking OpenAI's prefix-based cache. Additionally, prompts are just below the 1024 token auto-cache threshold (core: 1009 tokens, subtasks: 936 tokens). This results in 0% cache hit rate and missed cost/latency savings.
- **Why First:** No dependencies, immediate 47% cost savings, low risk implementation
- **Problem Analysis:**
  - **Current Structure (v2):**
    ```
    ROLE_AND_INSTRUCTIONS (static, ~150 tokens)
    INPUT_VALIDATION (static, ~250 tokens)
    generateOutputRules(config) ← Dynamic values injected here!
      - Line 79: ${getDateISO()} - changes every request
      - Line 86: ${categories.join(", ")} - dynamic per request
      - Line 94-99: Priority levels/scores - dynamic per request
    ```
  - **Cache Behavior:** OpenAI caches based on PREFIX matching (first ~256 tokens). When dynamic values appear at line ~65, the cache breaks before most instructions are processed.
  - **Token Counts:**
    - Core v2: 1009 tokens (15 tokens short of 1024 threshold)
    - Subtasks v1: 936 tokens (88 tokens short)
  - **Current Metrics:** `input_tokens_details: { cached_tokens: 0 }` - no caching happening
- **Solution Design:**
  - **Restructure Prompt:** Static template first, dynamic config last
    ```
    ROLE_AND_INSTRUCTIONS (static, ~150 tokens)
    INPUT_VALIDATION (static, ~250 tokens)
    OUTPUT_FORMAT_TEMPLATE (static, ~550 tokens) ← Generic references only
      - "Use current UTC time provided in Configuration section"
      - "Select from categories provided in Configuration section"
      - "Use priority levels specified in Configuration section"
    ADDITIONAL_GUIDANCE (static, ~75 tokens) ← Push over 1024 threshold
      - More vague input examples (generic, no hardcoded values)
      - Edge case handling patterns (multiple deadlines, etc.)
      - Priority scoring guidelines (conceptual tiers, not specific values)
    ------- 1024 token threshold = cacheable prefix! -------
    CONFIGURATION (dynamic, ~50 tokens) ← Injected at end
      - Current UTC time: 2026-02-16T10:30:00Z
      - Available categories: work, personal, health, finance, errand
      - Priority levels: low, medium, high, critical
      - Score ranges: low (0-3), medium (4-6), high (7-8), critical (9-10)
    ```
  - **Key Principle:** NEVER hardcode categories/priorities in static section. Use generic references ("categories provided below") and inject actual values at the end.
  - **Content to Add (Static Section, +75 tokens):**

    ```markdown
    ### Additional Vague Input Examples

    Return error for inputs like:

    - "Handle that thing" - no specific action or object identified
    - "Update files" - missing context about which files and what changes
    - "Call them" - unclear who the recipient is
    - "Work on the project" - too generic, no specific deliverable or action
    - "Deal with emails" - vague action, no specific outcome defined

    ### Edge Case Handling

    When multiple conflicting signals appear in the input:

    - Multiple deadlines: Select the earliest explicitly stated deadline
    - Contradictory urgency: Prioritize explicit time markers over vague terms
    - Ambiguous categorization: When task spans multiple areas, select based on the primary deliverable or outcome
    - Timezone-less dates: Interpret relative to the UTC reference time provided

    ### Priority Assessment Framework

    Use this conceptual framework when scoring priorities:

    - Highest tier: Immediate consequences if delayed, blocks other work, externally imposed deadline
    - Upper tier: Significant impact but some scheduling flexibility remains
    - Middle tier: Routine work with moderate consequences, standard timelines
    - Lower tier: Discretionary tasks, minimal urgency, can be deferred without major impact

    Note: Apply the specific score ranges and level names from the Configuration section below.
    ```

  - **Versioning Strategy:**
    - `parse-task-core-prompt-v3.ts` - NEW version with cache-optimized structure
    - `parse-task-subtasks-prompt-v2.ts` - NEW version (currently v1)
    - Keep v1/v2 stable for comparison and rollback
    - Add env var: `PARSE_TASK_CORE_PROMPT_VERSION=v1|v2|v3`

- **Expected Impact:**
  - **Core Prompt (v3):**
    - Static tokens: ~1025 (cacheable)
    - Dynamic tokens: ~50 (not cached)
    - Cache hit rate: 95%+ (1025/1075 tokens)
    - Cost reduction: ~47% on input tokens (50% discount on cached tokens)
    - Latency reduction: ~20-30% (cached prefixes process faster)
  - **Subtasks Prompt (v2):**
    - Only restructure (static first, dynamic last)
    - Don't force to 1024 unless valuable content available
    - Still benefits from restructuring when prompt grows naturally
- **Measurement Plan:**
  - **Metric to Track:** `response.usage.input_tokens_details.cached_tokens`
  - **Cache Hit Rate Formula:** `cached_tokens / input_tokens × 100%`
  - **New Prometheus Metric:**
    ```typescript
    export const openaiApiCachedTokensTotal = new Counter({
      name: "openai_api_cached_tokens_total",
      help: "Total cached prompt tokens from OpenAI prompt caching",
      labelNames: ["capability", "operation", "model"],
    });
    ```
  - **Grafana Query (Cache Hit Rate):**
    ```promql
    (
      sum(rate(openai_api_cached_tokens_total{capability="parse-task"}[5m]))
      /
      sum(rate(openai_api_tokens_total{capability="parse-task", type="input"}[5m]))
    ) * 100
    ```
  - **Success Criteria:** >95% cache hit rate on core prompt v3
  - **A/B Test:** Run 50% traffic on v2 vs v3 for 24 hours, compare metrics
- **Implementation Checklist:**
  - [ ] Update OpenAI response capture to extract `input_tokens_details.cached_tokens`
  - [ ] Add Prometheus metric `openai_api_cached_tokens_total`
  - [ ] Update `recordOpenAiApiSuccessMetrics()` to record cached tokens
  - [ ] Create `parse-task-core-prompt-v3.ts` with restructured prompt
  - [ ] Create `parse-task-subtasks-prompt-v2.ts` with restructured prompt
  - [ ] Add generic examples/guidance to core v3 static section (+75 tokens)
  - [ ] Update env schema to support `v3` option for core prompt
  - [ ] Update tests for v3 prompts
  - [ ] Add Grafana dashboard panel for cache hit rate
  - [ ] Deploy v3 behind feature flag
  - [ ] Run A/B test (v2 vs v3) for 24 hours
  - [ ] Verify >95% cache hit rate before full rollout
  - [ ] Update CLAUDE.md with v3 usage instructions
- **Files to Create:**
  - `backend/services/ai/src/capabilities/parse-task/prompts/core/v3/parse-task-core-prompt-v3.ts` (NEW)
  - `backend/services/ai/src/capabilities/parse-task/prompts/subtasks/v2/parse-task-subtasks-prompt-v2.ts` (NEW)
- **Files to Modify:**
  - `backend/services/ai/src/services/openai/openai-service.ts` - Capture `cached_tokens`
  - `backend/services/ai/src/metrics/openai-metrics.ts` - Add cached tokens metric
  - `backend/services/ai/src/capabilities/parse-task/prompts/core/index.ts` - Add v3 export
  - `backend/services/ai/src/config/env.ts` - Add `v3` to choices
- **OpenAI Caching Facts:**
  - **Auto-enabled:** Prompts with 1024+ tokens (automatic, no manual control)
  - **Cache mechanism:** Prefix-based matching (first ~256 tokens determine routing)
  - **Cache TTL:** 5-10 minutes idle, maximum 1 hour
  - **Cost savings:** 50% discount on cached tokens
  - **Latency savings:** Up to 80% faster processing for cached prefixes
  - **No manual override:** Cannot force caching for prompts <1024 tokens
- **Trade-offs:**
  - **Pro:** Significant cost/latency savings (47% cost reduction on core)
  - **Pro:** Future-proof as prompts grow
  - **Pro:** No behavior change, just restructuring
  - **Con:** Slightly longer total prompt (1009 → 1075 tokens for core)
  - **Con:** Additional complexity managing v3 version
  - **Mitigation:** The 66 extra tokens are offset by 50% discount on 1025 cached tokens
- **Priority:** High
- **Status:** 🔲 Planned

### 2. Infrastructure Metrics & Observability

- **Context:** Add production-grade infrastructure monitoring for CPU, memory, and HTTP latency metrics across all services (tasks, ai, ai-consumer)
- **Why Second:** Creates `httpMetricsMiddleware` foundation needed by #3, enables monitoring for all subsequent changes
- **Dependencies:** None
- **Blocks:** #3 (Middleware Refactoring needs this middleware)
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

### 3. Middleware Refactoring: Top-Level Request Tracking

- **Context:** Currently `requestId` and `requestResponseMetadata` are applied per-router (inside `routers/index.ts`), causing them to run only for specific routes. Move to top-level app middleware for universal coverage.
- **Why Third:** Depends on #2's `httpMetricsMiddleware` being created first
- **Dependencies:** Requires #2 (Infrastructure Metrics)
- **Blocks:** None
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
  - **Note**: This task is separate from Task #2 (Infrastructure Metrics). Task #2 creates the NEW `httpMetricsMiddleware`, this task refactors the EXISTING `requestResponseMetadata`
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

### 4. Multi-Tenant Architecture

- **Why Fourth:** Major architectural foundation, must precede #5 (Semantic Search)
- **Dependencies:** None
- **Blocks:** #5 (Semantic Search needs `account_id` filtering)
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

### 5. Semantic Search with Embeddings

- **Context:** Enable finding conceptually similar tasks beyond keyword matching. Users can discover related tasks even when using different terminology, synonyms, or describing concepts differently.
- **Why Fifth:** Query pattern requires `WHERE account_id = $1` from #4's multi-tenant data model
- **Dependencies:** Requires #4 (Multi-Tenant Architecture)
- **Blocks:** None
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

### 6. Load Balancing & Horizontal Scaling

- **Why Sixth:** Should come after architecture is stable and proven in production
- **Dependencies:** Benefits from all prior changes being stable
- **Blocks:** None
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
