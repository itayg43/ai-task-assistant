# Plan 4: Separate HTTP and Consumer Deployments

## Overview

**Focus**: Separate the AI service into two independent deployments: HTTP API service and message queue consumer service.

**Dependencies**: None (can be executed independently)

**Problem**: Currently, the HTTP server and RabbitMQ consumer run in the same process:

- Both share the same resources (CPU, memory, event loop)
- Cannot scale independently
- Resource contention between HTTP requests and AI processing
- Single point of failure affects both services

**Solution**: Deploy as separate services with:

- **HTTP API Service (`ai`)**: Handles incoming requests, publishes to RabbitMQ
- **Consumer Service (`ai-consumer`)**: Consumes from RabbitMQ, processes capabilities asynchronously
- Independent scaling and resource allocation
- Clear separation of concerns

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│   HTTP Server   │         │    Consumer     │
│   (Container)   │         │   (Container)   │
├─────────────────┤         ├─────────────────┤
│ Process 1       │         │ Process 2       │
│                 │         │                 │
│ - Express app   │         │ - RabbitMQ      │
│ - Publishes to  │         │   consumer      │
│   RabbitMQ      │         │ - Executes      │
│ - Returns 202   │         │   capabilities  │
│                 │         │ - Sends         │
│ Connection 1    │         │   callbacks     │
│ Channel 1       │         │                 │
└────────┬────────┘         │ Connection 2    │
         │                  │ Channel 2       │
         │                  └────────┬────────┘
         │                           │
         └────────────┬──────────────┘
                      │
              ┌───────▼───────┐
              │   RabbitMQ    │
              │   (Broker)    │
              └───────────────┘
```

## Resource Allocation Strategy

### HTTP API Service

- **Minimum (Intended Baseline)**: 0.5 CPU / 256MB
- **Maximum (Burst Capacity)**: 1 CPU / 512MB
- **Rationale**: Lightweight HTTP handling, mostly I/O bound

### Consumer Service

- **Minimum (Intended Baseline)**: 0.5 CPU / 512MB
- **Maximum (Burst Capacity)**: 1 CPU / 1GB
- **Rationale**: Mostly waiting on OpenAI API (network I/O), but needs buffer for JSON parsing and Zod validation

**Note**: Docker Compose only enforces maximum limits. Minimums are documented for planning and future Kubernetes migration.

## Implementation Steps

### 1. Refactor Terminology: Worker → Consumer

**Rationale**: Use "consumer" terminology for consistency with RabbitMQ/Kafka patterns and clarity about the service's role.

#### 1.1 Rename Directories and Files

**Location**: `backend/services/ai/src/`

**Important**: Rename in this order to avoid path conflicts:

- [ ] First, rename the inner directory: `src/workers/capabilities-worker/` → `src/workers/capabilities-consumer/`
- [ ] Then rename files within: `capabilities-worker.ts` → `capabilities-consumer.ts` and `capabilities-worker.test.ts` → `capabilities-consumer.test.ts`
- [ ] Finally, rename the outer directory: `src/workers/` → `src/consumers/`

#### 1.2 Update TypeScript Configuration

**File**: `backend/services/ai/tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      // ... existing paths ...
      "@consumers/*": ["src/consumers/*"] // Changed from @workers/*
    }
  }
}
```

- [ ] Update path alias: `@workers/*` → `@consumers/*`

#### 1.3 Update Code References

**File**: `backend/services/ai/src/consumers/capabilities-consumer/capabilities-consumer.ts`

- [ ] Find and replace: `"capabilitiesWorker"` → `"capabilitiesConsumer"` (logger name on line 21)

**File**: `backend/services/ai/src/consumers/capabilities-consumer/capabilities-consumer.test.ts`

- [ ] Update import statement: Change `@workers/capabilities-worker` → `@consumers/capabilities-consumer`
- [ ] Update describe block name: Change `"capabilitiesWorker"` → `"capabilitiesConsumer"`
- [ ] Update any comments mentioning "worker" → "consumer"

**File**: `backend/services/ai/src/consumers/capabilities-consumer/index.ts`

- [ ] Update export path: Change `"./capabilities-worker"` → `"./capabilities-consumer"`

### 2. Create Shared Utility for Consumer Process Event Handlers

**Rationale**: Create a reusable utility function for non-HTTP services (like consumers) that need process event handling without an HTTP server dependency.

**File**: `backend/shared/src/utils/process-event/register-process-event-handlers/register-process-event-handlers.ts`

**Action**: Add the following function to the existing file (append after the `registerProcessEventHandlers` function):

```typescript
// Add these NEW imports at the top of the file (after existing imports)
// Note: ProcessExitCallback, ServicesCleanupCallbacks, and logger are already imported/defined
import { PROCESS_EXIT_CODE, SERVER_SHUTDOWN_STATE } from "../../../constants";
import { performFailureCleanup } from "../../server";

// Helper function to check if shutdown is already in progress
// Note: logger is already defined at the top of the file - use the existing logger variable
function checkIfShutdownAlreadyInProgress(shutdownView: Uint8Array): boolean {
  const expected = SERVER_SHUTDOWN_STATE.NOT_SHUTTING_DOWN;
  const replacement = SERVER_SHUTDOWN_STATE.SHUTTING_DOWN;

  return (
    Atomics.compareExchange(shutdownView, 0, expected, replacement) !== expected
  );
}

export const registerProcessEventHandlersForConsumer = (
  processExitCallback: ProcessExitCallback,
  servicesCleanupCallbacks?: ServicesCleanupCallbacks
) => {
  const shutdownBuffer = new SharedArrayBuffer(1);
  const shutdownView = new Uint8Array(shutdownBuffer);

  const shutdown = async (event: string, errorOrReason: unknown) => {
    logger.info(`Invoked by event: ${event}`);

    if (checkIfShutdownAlreadyInProgress(shutdownView)) {
      logger.info("Shutdown already in progress, skipping.");
      return;
    }

    if (errorOrReason) {
      logger.error(`Shutting down due to ${event}:`, errorOrReason);
    } else {
      logger.info(`Received ${event}. Shutting down...`);
    }

    try {
      if (servicesCleanupCallbacks) {
        await servicesCleanupCallbacks.afterSuccess();
      }

      const exitCode = errorOrReason
        ? PROCESS_EXIT_CODE.ERROR
        : PROCESS_EXIT_CODE.REGULAR;

      logger.info(
        `Service shutdown completed. Exiting process. Exit code: ${exitCode}`
      );
      processExitCallback(exitCode);
    } catch (error) {
      logger.error(`Error during shutdown:`, error);
      await performFailureCleanup(servicesCleanupCallbacks?.afterFailure);
      processExitCallback(PROCESS_EXIT_CODE.ERROR);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT", undefined));
  process.on("SIGTERM", () => shutdown("SIGTERM", undefined));
  process.on("uncaughtException", (error) =>
    shutdown("uncaughtException", error)
  );
  process.on("unhandledRejection", (reason) =>
    shutdown("unhandledRejection", reason)
  );

  logger.info("Process event handlers registered for consumer");
};
```

**Important Notes**:

- **Existing imports** (already in file - do NOT add again):
  - `ProcessExitCallback` and `ServicesCleanupCallbacks` from `../../../types`
  - `logger` is already defined at the top of the file
- **New imports to add**:
  - `PROCESS_EXIT_CODE` and `SERVER_SHUTDOWN_STATE` from `../../../constants`
  - `performFailureCleanup` from `../../server` (relative to `register-process-event-handlers.ts`)
- **Helper function**: Implement `checkIfShutdownAlreadyInProgress` locally (can reuse logic from `shutdown-handler.ts`)
- **No HTTP server**: This function handles shutdown without closing an HTTP server (unlike `registerProcessEventHandlers`)

**Tasks:**

- [ ] Add NEW imports at the top of `register-process-event-handlers.ts` (after existing imports):
  - [ ] `PROCESS_EXIT_CODE` and `SERVER_SHUTDOWN_STATE` from `../../../constants`
  - [ ] `performFailureCleanup` from `../../server`
  - [ ] Note: `ProcessExitCallback`, `ServicesCleanupCallbacks`, and `logger` are already imported/defined - do NOT redeclare them
- [ ] Add `checkIfShutdownAlreadyInProgress` helper function (can reuse logic from `shutdown-handler.ts`)
- [ ] Add `registerProcessEventHandlersForConsumer` function after `registerProcessEventHandlers`
- [ ] Export the new function from `backend/shared/src/utils/process-event/register-process-event-handlers/index.ts`
- [ ] Add tests for `registerProcessEventHandlersForConsumer` in `register-process-event-handlers.test.ts`:
  - [ ] **Test Structure** (follow testing rules):
    - [ ] Use `describe`, `it`, `expect`, `beforeEach`, `afterEach` from Vitest
    - [ ] Use `Mocked<T>` from `@shared/types` for typed mocks
    - [ ] Use `vi.mock()` at top level to mock `../../server` module (for `performFailureCleanup`)
    - [ ] Use `vi.mocked()` for properly typed mock functions
    - [ ] Use `vi.clearAllMocks()` in `afterEach` (since mocks are used)
    - [ ] Follow Arrange-Act-Assert pattern
  - [ ] **Test Cases**:
    - [ ] Use `it.each()` to test all process events (SIGINT, SIGTERM, uncaughtException, unhandledRejection) are registered
    - [ ] Test that cleanup callbacks (`afterSuccess`) are called correctly for each event type
    - [ ] Test that process exits with correct exit codes (REGULAR for normal shutdown, ERROR for errors)
    - [ ] Test that shutdown is skipped if already in progress (concurrent shutdown prevention using SharedArrayBuffer)
    - [ ] Test that `afterFailure` is called when `afterSuccess` throws an error
    - [ ] Test that function works without cleanup callbacks (optional parameter - undefined case)
    - [ ] Mock `performFailureCleanup` from `../../server` module using `vi.mock()` at top level
    - [ ] Use `vi.spyOn(process, "on")` to verify event handlers are registered (similar to existing test)
    - [ ] Follow existing test patterns from `registerProcessEventHandlers` tests (same structure and style)

### 3. Create Consumer Entry Point

**File**: `backend/services/ai/src/consumer.ts` (new file)

```typescript
import { closeRabbitMQClient, connectRabbitMQClient } from "@clients/rabbitmq";
import { consumeCapabilitiesMessage } from "@consumers/capabilities-consumer";
import { createLogger } from "@shared/config/create-logger";
import { registerProcessEventHandlersForConsumer } from "@shared/utils/process-event/register-process-event-handlers";

const logger = createLogger("consumer");

(async () => {
  try {
    logger.info("Starting AI service consumer...");

    // Register shutdown handlers using shared utility
    registerProcessEventHandlersForConsumer(process.exit, {
      afterSuccess: async () => {
        await closeRabbitMQClient();
      },
      afterFailure: async () => {
        await closeRabbitMQClient();
      },
    });

    await connectRabbitMQClient();
    await consumeCapabilitiesMessage();

    logger.info("AI service consumer started successfully");
  } catch (error) {
    logger.error("Consumer failed to start", error);
    await closeRabbitMQClient().catch(() => {
      // Ignore cleanup errors during startup failure
    });
    process.exit(1);
  }
})();
```

**Tasks:**

- [ ] Create `backend/services/ai/src/consumer.ts`
- [ ] Use `registerProcessEventHandlersForConsumer` for shutdown handling
- [ ] Initialize RabbitMQ connection and start consuming messages
- [ ] Handle startup errors gracefully

### 4. Update HTTP Server Entry Point

**File**: `backend/services/ai/src/server.ts`

**Current state** (before changes):

```typescript
import { closeRabbitMQClient, connectRabbitMQClient } from "@clients/rabbitmq";
import { env } from "@config/env";
import { initializeServer } from "@shared/utils/server";
import { consumeCapabilitiesMessage } from "@workers/capabilities-worker";
import { app } from "./app";

(async () => {
  await initializeServer(env.SERVICE_NAME, env.SERVICE_PORT, app, {
    startCallback: async () => {
      await connectRabbitMQClient();
      await consumeCapabilitiesMessage();
    },
    cleanupCallbacks: {
      afterSuccess: async () => {
        await closeRabbitMQClient();
      },
      afterFailure: async () => {
        await closeRabbitMQClient();
      },
    },
  });
})();
```

**Updated state** (after changes):

```typescript
import { closeRabbitMQClient, connectRabbitMQClient } from "@clients/rabbitmq";
import { env } from "@config/env";
import { initializeServer } from "@shared/utils/server";
import { app } from "./app";

(async () => {
  await initializeServer(env.SERVICE_NAME, env.SERVICE_PORT, app, {
    startCallback: async () => {
      // Keep RabbitMQ connection for publishing messages
      await connectRabbitMQClient();
    },
    cleanupCallbacks: {
      afterSuccess: async () => {
        await closeRabbitMQClient();
      },
      afterFailure: async () => {
        await closeRabbitMQClient();
      },
    },
  });
})();
```

**Tasks:**

- [ ] Remove the import line: `import { consumeCapabilitiesMessage } from "@workers/capabilities-worker";`
- [ ] Remove the call: `await consumeCapabilitiesMessage();` from `startCallback`
- [ ] Keep `connectRabbitMQClient()` call (needed for publishing messages to RabbitMQ)
- [ ] Keep all cleanup callbacks (they handle RabbitMQ connection cleanup)

### 5. Update Package.json Scripts

**File**: `backend/services/ai/package.json`

```json
{
  "scripts": {
    "build": "tsc && tsc-alias",
    "start": "node dist/server.js",
    "start:dev": "ts-node-dev --inspect=0.0.0.0:51204 -r tsconfig-paths/register --respawn src/server.ts",
    "start:consumer": "node dist/consumer.js",
    "start:consumer:dev": "ts-node-dev -r tsconfig-paths/register --respawn src/consumer.ts",
    "test": "vitest",
    "test:prompts": "npx dotenv-cli -e .env.test -- vitest --config vitest.prompts.config.ts"
  }
}
```

**Tasks:**

- [ ] Add `start:consumer` script (production)
- [ ] Add `start:consumer:dev` script (development)

### 6. Update Docker Compose Configuration

**File**: `docker-compose.dev.yml`

```yaml
services:
  ai:
    build:
      context: .
      dockerfile: backend/services/ai/Dockerfile.dev
    command: ["npm", "run", "start:dev", "-w", "backend/services/ai"]
    ports:
      - "3002:3002"
      - "51205:51204"
    env_file:
      - ./backend/services/ai/.env.dev
    volumes:
      - ./backend/services/ai:/app/backend/services/ai
      - ./backend/shared:/app/backend/shared
      - /app/node_modules
    # Resource allocation strategy:
    # - Minimum: 0.5 CPU / 256MB (intended baseline)
    # - Maximum: 1 CPU / 512MB (burst capacity)
    # Note: Docker Compose sets maximum limits only
    cpus: 1.0
    mem_limit: 512m
    develop:
      watch:
        - action: rebuild
          path: ./backend/services/ai/package.json
        - action: rebuild
          path: ./backend/services/ai/Dockerfile.dev
        - action: rebuild
          path: ./backend/shared/package.json
        - action: rebuild
          path: ./package.json
        - action: rebuild
          path: ./package-lock.json

  ai-consumer:
    build:
      context: .
      dockerfile: backend/services/ai/Dockerfile.dev
    command: ["npm", "run", "start:consumer:dev", "-w", "backend/services/ai"]
    env_file:
      - ./backend/services/ai/.env.dev
    volumes:
      - ./backend/services/ai:/app/backend/services/ai
      - ./backend/shared:/app/backend/shared
      - /app/node_modules
    # Resource allocation strategy:
    # - Minimum: 0.5 CPU / 512MB (intended baseline)
    # - Maximum: 1 CPU / 1GB (burst capacity)
    # Note: Docker Compose sets maximum limits only
    cpus: 1.0
    mem_limit: 1g
    develop:
      watch:
        - action: rebuild
          path: ./backend/services/ai/package.json
        - action: rebuild
          path: ./backend/services/ai/Dockerfile.dev
        - action: rebuild
          path: ./backend/shared/package.json
        - action: rebuild
          path: ./package.json
        - action: rebuild
          path: ./package-lock.json
```

**Tasks:**

- [ ] Add `ai-consumer` service to `docker-compose.dev.yml`
- [ ] Configure `ai-consumer` with `start:consumer:dev` command
- [ ] Set resource limits: 1 CPU / 1GB
- [ ] Add resource allocation comments (minimum/maximum strategy)
- [ ] Configure volume mounts and watch mode (same pattern as `ai` service)
- [ ] Do not add HTTP ports (consumer doesn't expose HTTP endpoints)

### 7. Update Production Docker Compose (Optional)

**File**: `docker-compose.yml`

If you have a production docker-compose file, update it similarly:

- [ ] Add `ai-consumer` service
- [ ] Configure production command: `start:consumer`
- [ ] Set resource limits
- [ ] Configure health checks (if applicable)

### 8. Update Tests

**Files to update**:

- `backend/services/ai/src/consumers/capabilities-consumer/capabilities-consumer.test.ts`
- Any other test files that import from `@workers/*`

**Tasks:**

- [ ] Update import in `capabilities-consumer.test.ts`: Change `@workers/capabilities-worker` → `@consumers/capabilities-consumer`
- [ ] Search for all files importing from `@workers/*` and update them to `@consumers/*`
- [ ] Run tests: `npm test -w backend/services/ai`
- [ ] Verify all tests pass after refactoring

### 9. Documentation Updates

**Tasks:**

- [ ] Update README.md to document the new architecture
- [ ] Add section explaining HTTP vs Consumer services
- [ ] Document resource allocation strategy
- [ ] Update any architecture diagrams
- [ ] Add notes about independent scaling

## Benefits

1. **Resource Isolation**: HTTP and consumer don't compete for resources
2. **Independent Scaling**: Scale HTTP based on request rate, consumer based on queue depth
3. **Fault Tolerance**: Consumer failures don't affect HTTP availability (messages queue)
4. **Clear Separation**: Each service has a single, well-defined responsibility
5. **Production Ready**: Architecture supports easy migration to Kubernetes/cloud platforms

## Migration Path to Production

For production deployment (Kubernetes/cloud platforms), this architecture easily translates to:

- **HTTP API Deployment**: Separate Kubernetes Deployment with resource requests/limits
- **Consumer Deployment**: Separate Kubernetes Deployment with resource requests/limits
- **Independent Scaling**: Horizontal Pod Autoscaler based on different metrics
- **Health Checks**: Separate liveness/readiness probes per service type

## Testing Checklist

- [ ] HTTP service starts and accepts requests
- [ ] HTTP service can publish messages to RabbitMQ
- [ ] Consumer service starts and connects to RabbitMQ
- [ ] Consumer processes messages correctly
- [ ] Consumer sends callbacks to Tasks service
- [ ] Both services can be stopped gracefully
- [ ] Resource limits are documented correctly
- [ ] All tests pass after refactoring

## Notes

- Each service maintains its own RabbitMQ connection and channel (separate processes = separate connections)
- This is the recommended pattern for RabbitMQ consumers
- Docker Compose resource limits are hints only (not enforced in standalone mode)
- For production, use Kubernetes or cloud platforms for proper resource management
