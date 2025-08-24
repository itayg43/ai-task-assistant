## Modules

### Clients

#### Redis Client

```typescript
import {
  createRedisClient,
  connectRedisClient,
  closeRedisClient,
  destroyRedisClient,
} from "@shared/clients/redis";
```

**Features:**

- Connection management with timeout handling
- Graceful shutdown
- Error handling and logging
- Ready state detection

#### Redlock Client

```typescript
import { createRedlockClient } from "@shared/clients/redlock";
```

**Features:**

- Distributed locking setup
- Configurable retry settings
- Connection pooling support

### Config

#### Logger

```typescript
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("service-name");
logger.info("Application started");
logger.error("An error occurred", error);
logger.warn("Warning message");
```

**Features:**

- Structured logging with timestamps
- Log levels (INFO, ERROR, WARN)
- Context support for additional data
- JSON formatting for objects

### Middlewares

#### CORS

```typescript
import { createCors } from "@shared/middlewares/cors/create-cors";

const cors = createCors(["http://localhost:3001", "http://tasks:3001"]);

app.use(cors);
```

**Features:**

- Configurable allowed origins
- Automatic health endpoint allowance (no-origin requests to `/health/*` are allowed)
- Secure blocking of unauthorized origins
- Comprehensive logging for debugging and audit trails
- Express middleware compatible
- No-origin requests only allowed to health endpoints for security
- Strict origin validation against allowed origins list
- Proper HTTP 403 Forbidden responses for unauthorized requests

#### Error Handler

```typescript
import { errorHandler } from "@shared/middlewares/error-handler";

app.use(errorHandler);
```

**Features:**

- Automatic error formatting
- Zod validation error handling
- Custom error class support
- Proper HTTP status codes

#### Request/Response Metadata

```typescript
import { requestResponseMetadata } from "@shared/middlewares/request-response-metadata";

app.use(requestResponseMetadata);
```

**Features:**

- Request ID generation
- Response time tracking
- Request logging

#### Schema Validation

```typescript
import { validateSchema } from "@shared/middlewares/validate-schema";
import { z } from "zod";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

app.post("/users", validateSchema(userSchema), createUser);
```

#### Token Bucket Rate Limiter

```typescript
import { createTokenBucketRateLimiter } from "@shared/middlewares/token-bucket-rate-limiter";

const rateLimiter = createTokenBucketRateLimiter(redisClient, redlockClient, {
  serviceName: "my-service",
  rateLimiterName: "api-limiter",
  bucketSize: 100,
  refillRate: 10,
  bucketTtlSeconds: 3600,
  lockTtlMs: 5000,
});

app.use("/api", rateLimiter);
```

**Features:**

- Configurable bucket size and refill rate
- Per-user rate limiting (uses authentication context)
- Redis-based storage with TTL
- Distributed locking with Redlock
- Automatic token refill over time
- Configurable lock timeout
- Comprehensive logging and error handling

### Utils

#### Count Tokens

```typescript
import {
  countTokens,
  predefinedTokenCounters,
} from "@shared/utils/count-tokens";

// Count tokens for any model
const { count, duration } = countTokens("gpt-4o-mini", "Hello, world!");

// Use predefined counter for common models
const tokenCount = predefinedTokenCounters["gpt-4o-mini"]("Hello, world!");
```

**Features:**

- Token counting for any Tiktoken model
- Performance timing with duration tracking
- Predefined counters for common models (gpt-4o-mini)
- Comprehensive logging with model, text, count, and duration

#### With Duration

```typescript
import {
  withDurationAsync,
  withDurationSync,
} from "@shared/utils/with-duration";

// Async operations with duration tracking
const { result, duration } = await withDurationAsync(async () => {
  return await someAsyncOperation();
});

// Sync operations with duration tracking
const { result, duration } = withDurationSync(() => {
  return someSyncOperation();
});
```

**Features:**

- Duration tracking for both async and sync operations
- Returns result wrapped with execution time
- Useful for performance monitoring and logging

#### Date Time

```typescript
import {
  getCurrentTime,
  getElapsedTime,
  getCurrentDate,
  getDateISO,
} from "@shared/utils/date-time";

const start = getCurrentTime();
// ... some operation
const elapsed = getElapsedTime(start);
const now = getCurrentDate();
const isoString = getDateISO();
```

**Features:**

- High-precision timestamp utilities
- Elapsed time calculation
- ISO date string generation
- Consistent date/time handling across the application

#### Exhaustive Switch

```typescript
import { exhaustiveSwitch } from "@shared/utils/exhaustive-switch";

type Status = "pending" | "completed" | "failed";

const getStatusMessage = (status: Status) => {
  return exhaustiveSwitch(status, {
    pending: () => "Operation is pending",
    completed: () => "Operation completed successfully",
    failed: () => "Operation failed",
  });
};
```

**Features:**

- Type-safe exhaustive switch handling
- Compile-time checking for missing cases
- Runtime error if unhandled value is encountered
- Perfect for union type handling

#### Zod Schema Helpers

```typescript
import { trimString, isNonEmptyString } from "@shared/utils/zod-schema-helpers";
import { z } from "zod";

const userSchema = z
  .string()
  .transform(trimString)
  .refine(isNonEmptyString, "String cannot be empty");
```

**Features:**

- String trimming utility for Zod transforms
- Non-empty string validation
- Designed for Zod's transform + refine pattern
- Ensures proper validation flow

#### With Retry

```typescript
import { withRetry } from "@shared/utils/with-retry";

const result = await withRetry(
  { maxAttempts: 3, baseDelayMs: 1000, backoffMultiplier: 2 },
  async () => {
    return await unreliableOperation();
  }
);
```

**Features:**

- Configurable retry attempts with exponential backoff
- Comprehensive logging for each attempt
- Configurable base delay and backoff multiplier
- Automatic error handling and retry logic

#### Start Server

```typescript
import { startServer } from "@shared/utils/start-server";

await startServer(server, 3000);
```

**Features:**

- Promise-based server startup
- Automatic error handling
- Logging of server status
- Clean startup sequence

#### With Lock

```typescript
import { withLock } from "@shared/utils/with-lock";

const result = await withLock(
  "resource-key",
  async () => {
    // Critical section code
    return "operation result";
  },
  {
    timeout: 5000,
    retryDelay: 100,
  }
);
```

**Features:**

- Distributed locking with Redlock
- Automatic lock release
- Configurable timeouts
- Error handling

#### Process Event Handlers

```typescript
import { registerProcessEventHandlers } from "@shared/utils/process-event/register-process-event-handlers";

const processExitCallback = (code: number) => {
  console.log(`Process exiting with code: ${code}`);
  process.exit(code);
};

const cleanupCallbacks = {
  afterSuccess: async () => {
    console.log("Server closed successfully");
  },
  afterFailure: () => {
    console.error("Failed to close server gracefully");
  },
};

registerProcessEventHandlers(server, processExitCallback, cleanupCallbacks);
```

**Features:**

- Graceful shutdown handling for SIGTERM/SIGINT
- Uncaught exception handling
- Unhandled rejection handling
- Atomic shutdown protection (prevents race conditions)
- Configurable cleanup callbacks for success/failure scenarios
- Automatic process exit with appropriate exit codes

## Testing

### Running Tests

```bash
npm run test
```

### Mock Utilities

```typescript
import {
  createRedisClientMock,
  createRedlockClientMock,
  setupAcquireMock,
} from "@shared/mocks";

// Create Redis mock with common methods
const redisMock = createRedisClientMock();
// Returns mock with: hgetall, hmset, expire methods

// Create Redlock mock
const redlockMock = createRedlockClientMock();
// Returns mock with: acquire method

// Configure Redlock acquire behavior
setupAcquireMock(redlockMock, "lock-value", true); // Resolves with value
setupAcquireMock(redlockMock, new Error("Lock failed"), false); // Rejects with error
```
