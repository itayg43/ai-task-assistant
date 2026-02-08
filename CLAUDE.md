# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Async AI-powered task management system. Two microservices communicate via RabbitMQ: a **Tasks Service** (Express + Prisma + PostgreSQL) and an **AI Service** (Express + OpenAI). The system uses Redis for distributed locking/rate limiting and Prometheus/Grafana for monitoring.

## Commands

```bash
# Start all services (Docker Compose with watch mode)
npm run start:dev

# Run all unit tests (watch mode)
npm test

# Run tests once (CI)
npm test -- --run

# Run a single test file
npx vitest run backend/services/tasks/src/controllers/some-controller.test.ts

# Run tests for a specific workspace
npm test -w backend/services/ai
npm test -w backend/services/tasks
npm test -w backend/shared

# Database integration tests (resets test DB first)
npm run test:db

# Prompt evaluation tests
npm run test:prompts

# Type checking (watch mode)
npm run type-check

# Type checking (one-time, CI)
npm run type-check:ci

# Prisma (from backend/services/tasks)
npm run prisma:generate -w backend/services/tasks
npm run prisma:migrate:dev -w backend/services/tasks
npm run prisma:seed -w backend/services/tasks
```

## Architecture

### Monorepo Structure (npm workspaces)

- `backend/shared/` — Shared utilities, middleware, clients, error classes, types
- `backend/services/ai/` — AI capabilities service (port 3002) + RabbitMQ consumer
- `backend/services/tasks/` — Task management service (port 3001) + webhook receiver

### Async Processing Flow

1. Client calls Tasks Service `POST /api/v1/tasks` with natural language
2. Tasks Service forwards to AI Service `POST /api/v1/capabilities/:capability`
3. AI Service validates, queues message to RabbitMQ, returns `202 Accepted`
4. AI Consumer (separate process) picks up message, calls OpenAI, posts result to webhook
5. Tasks Service webhook controller `POST /api/v1/webhooks/create-task` receives callback, creates DB records

### Key Patterns

- **Capability System**: Strategy pattern in `services/ai/src/capabilities/`. Each capability has a handler, input/output Zod schemas, and prompt injection fields.
- **Repository Pattern**: Data access in `services/tasks/src/repositories/`. Functions accept both `PrismaClient` and `PrismaTransactionClient` for transaction support.
- **Higher-order wrappers**: `withRetry` (exponential backoff), `withLock` (Redlock distributed locking), `withMetrics` (Prometheus recording), `withDuration` (timing).
- **Custom Error Hierarchy**: All errors extend `BaseError` with `statusCode` and `context`. Types: `AuthenticationError`, `BadRequestError`, `ForbiddenError`, `InternalError`, `NotFoundError`, `ServiceUnavailableError`, `TooManyRequestsError`.
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
- **Test files**: Colocated with source code as `*.test.ts`
- **Integration tests**: `*.integration.test.ts` (excluded from default `npm test`)
- **Mocking**: Use `vi.mock()` with path aliases (e.g., `vi.mock('@config/env', ...)`)
- **Integration test pattern**: Use `supertest` with the Express app, mock external dependencies

## Infrastructure (Docker Compose)

Services: `ai` (3002), `ai-consumer`, `tasks` (3001), `postgres` (5432), `redis` (6379), `rabbitmq` (5672/15672), `prometheus` (9090), `grafana` (3000).

Known issue: On first run, tasks service may fail to connect to postgres before it's ready. Fix: `docker-compose restart tasks`.
