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

#### Process Event Handlers

```typescript
import { registerProcessEventHandlers } from "@shared/utils/process-event/register-process-event-handlers";

registerProcessEventHandlers(server, {
  onShutdown: () => console.log("Shutting down gracefully"),
  onError: (error) => console.error("Unhandled error:", error),
});
```

**Features:**

- Graceful shutdown handling
- SIGTERM/SIGINT support
- Uncaught exception handling
- Unhandled rejection handling

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

## Testing

### Running Tests

```bash
npm test
```

### Mock Utilities

```typescript
import {
  createRedisClientMock,
  createRedlockClientMock,
  setupAcquireMock,
} from "@shared/mocks";

// Use in tests
const redisMock = createRedisClientMock();
const redlockMock = createRedlockClientMock();
setupAcquireMock(redlockMock, "lock-value", true);
```
