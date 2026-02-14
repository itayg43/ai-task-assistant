# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Async AI-powered task management system. Two microservices communicate via RabbitMQ: a **Tasks Service** (Express + Prisma + PostgreSQL) and an **AI Service** (Express + OpenAI). The system uses Redis for distributed locking/rate limiting and Prometheus/Grafana for monitoring.

## Commands

```bash
# Start all services (Docker Compose with watch mode)
npm run start:dev

# Type checking (ALWAYS run this before tests when making code changes)
npm run type-check:ci

# Run standard tests (unit + integration, excludes database/prompts)
npm test -- --run

# Database integration tests (resets test DB, runs with real PostgreSQL)
npm run test:db

# Prompt evaluation tests
npm run test:prompts

# Prisma (from backend/services/tasks)
npm run prisma:generate -w backend/services/tasks
npm run prisma:migrate:dev -w backend/services/tasks
npm run prisma:seed -w backend/services/tasks
```

**Important**: After making code changes, ALWAYS run `npm run type-check:ci` before running tests. This catches TypeScript errors early and provides faster feedback than waiting for test failures.

## Architecture

### Monorepo Structure (npm workspaces)

- `backend/shared/` — Shared utilities, middleware, clients, error classes, types
- `backend/services/ai/` — AI capabilities service (port 3002) + RabbitMQ consumer
- `backend/services/tasks/` — Task management service (port 3001) + webhook receiver

### Independent Scaling Architecture

The AI service and AI consumer are **separate deployable units** that can scale independently:

**AI Service (HTTP Server)**:
- Port 3002
- Handles incoming HTTP requests
- Validates input and queues to RabbitMQ
- Returns `202 Accepted` immediately
- **Scaling factor**: Incoming request rate

**AI Consumer (RabbitMQ Worker)**:
- No HTTP server
- Processes queued messages
- Calls OpenAI API (long-running operations)
- Sends webhook callbacks
- **Scaling factor**: Queue depth + message processing time

**Benefits**:
- **Resource Isolation**: Long OpenAI calls (5-15s) don't block HTTP requests
- **Independent Horizontal Scaling**: Scale API based on request rate, consumers based on queue backlog
  - Example: 1 AI service + 3 AI consumers
  - Example: 2 AI services + 5 AI consumers during peak load
- **Fault Isolation**: Consumer crashes don't affect API availability
- **Different Resource Profiles**: Consumers need more CPU/memory for processing, API optimized for low latency
- **Cost Optimization**: Can use different instance types for each component

This pattern is used by production systems like Stripe (webhook processing), GitHub Actions (job runners), and AWS Lambda (event processing).

### Async Processing Flow

**Request Path** (synchronous):

1. Client → Tasks Service `POST /api/v1/tasks` with natural language
2. Rate limiter reserves tokens, stores metadata in Redis (1-hour TTL)
3. Tasks Service → AI Service `POST /api/v1/capabilities/:capability`
4. AI Service validates input, queues message to RabbitMQ
5. Tasks Service receives `202 Accepted`, returns to client

**Callback Path** (asynchronous via RabbitMQ):

1. AI Consumer picks up queued message
2. Consumer calls OpenAI API, receives response with actual token usage
3. Consumer → Tasks Service `POST /api/v1/webhooks/create-task` with result + OpenAI metadata
4. Webhook controller creates DB records (success) or records error metrics (failure)
5. Background: Token reconciliation (actual vs reserved) + metrics recording
6. Background: Metadata cleanup from Redis

**Error Handling**:

- Request-path errors (prompt injection, validation): Reconcile with 0 tokens immediately
- Callback-path errors with OpenAI metadata (vague input): Reconcile with actual tokens
- Callback-path errors without OpenAI metadata (API failures): Reconcile with 0 tokens
- Error transformation at service boundary: AI→Tasks (full context), Tasks→Client (sanitized)

### Key Patterns

- **Capability System**: Strategy pattern in `services/ai/src/capabilities/`. Each capability has a handler, input/output Zod schemas, and prompt injection fields.
- **Repository Pattern**: Data access in `services/tasks/src/repositories/`. Functions accept both `PrismaClient` and `PrismaTransactionClient` for transaction support.
- **Token Usage System**: Reserve tokens upfront (rate limiter), store metadata in Redis (1-hour TTL), reconcile actual vs reserved tokens asynchronously via webhook callbacks. Handles all error scenarios (vague input with tokens, API failures with 0 tokens, request-path errors). Uses `reconcileTokensIfPossible()` helper for DRY pattern.
- **Higher-order wrappers**: `withRetry` (exponential backoff), `withLock` (Redlock distributed locking), `withMetrics` (Prometheus recording), `withDuration` (timing).
- **Custom Error Hierarchy**: All errors extend `BaseError` with `statusCode` and `context`. Types: `AuthenticationError`, `BadRequestError`, `ForbiddenError`, `InternalError`, `NotFoundError`, `ServiceUnavailableError`, `TooManyRequestsError`. Internal error context (like `type`) is preserved for service-to-service communication but stripped before returning to clients.
- **Middleware chain**: `requestId → authentication → requestResponseMetadata → rateLimiter → validateSchema → controller → errorHandler`. Validated data stored in `res.locals`.
- **Zod validation**: All request/response schemas use Zod. Access validated data via `getValidatedQuery<T>(res)`, `getValidatedParams<T>(res)`, `getCapabilityValidatedInput(res)`.
- **Environment config**: Each service has `src/config/env.ts` using `envalid` for validation. Separate `.env.dev` and `.env.test` files per service.

### Path Aliases

All services use TypeScript path aliases (resolved by `tsc-alias` for build, `vite-tsconfig-paths` for tests):

```
@shared/*       → ../../shared/src/*
@config/*       → src/config/*
@controllers/*  → src/controllers/*
@services/*     → src/services/*
@repositories/* → src/repositories/*
@middlewares/*  → src/middlewares/*
@clients/*      → src/clients/*
@schemas        → src/schemas
@types          → src/types
@mocks/*        → src/mocks/*
@consumers/*    → src/consumers/*
@metrics/*      → src/metrics/*
```

### Database (Prisma)

Schema at `backend/services/tasks/prisma/schema.prisma`. Two models: `Task` (with fields like `title`, `category`, `priorityLevel`, `priorityScore`) and `Subtask` (ordered, cascade-deleted with parent). Tables use snake_case column names mapped from camelCase fields.

## Testing

- **Framework**: Vitest with `globals: true` (no need to import `describe`/`it`/`expect`)
- **Test files**: Colocated with source code as `*.test.ts` (unit) or `*.integration.test.ts` (integration)
- **Standard tests**: `npm test -- --run` runs unit + integration tests (excludes database/prompts)
- **Database tests**: `npm run test:db` runs Prisma repository tests with real PostgreSQL
- **Mocking**: Use `vi.mock()` with path aliases (e.g., `vi.mock('@config/env', ...)`)
- **Fire-and-forget testing**: Use `waitForBackgroundTasks()` from `@shared/test-utils` after triggering `void` operations
- **Detailed patterns**: See `.claude/rules/testing.md` for mock hoisting, shared mocks, and test structure

## Infrastructure (Docker Compose)

Services: `ai` (3002), `ai-consumer`, `tasks` (3001), `postgres` (5432), `redis` (6379), `rabbitmq` (5672/15672), `prometheus` (9090), `grafana` (3000).

All services have healthchecks configured. Proper startup order: infrastructure (postgres, redis, rabbitmq) become healthy → app services start.
