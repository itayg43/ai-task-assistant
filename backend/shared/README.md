## Available Modules

### Clients

#### Redis Client

```typescript
import {
  connectRedisClient,
  destroyRedisClient,
  getRedisClient,
} from "@shared/clients/redis";
```

**Features:**

- Connection management
- Graceful shutdown
- Error handling

#### Redlock Client

```typescript
import {
  connectRedlockClient,
  destroyRedlockClient,
  getRedlockClient,
} from "@shared/clients/redlock";
```

**Features:**

- Distributed locking
- Automatic cleanup
- Connection pooling

### Config

#### Logger

```typescript
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("service-name");
logger.info("Application started");
logger.error("An error occurred", { error });
```

**Features:**

- Structured logging
- Log levels (DEBUG, INFO, WARN, ERROR)
- Request context tracking
- JSON formatting

### Constants

```typescript
import {
  PROCESS_EXIT_CODE,
  LOGGER_LOG_LEVEL,
  DATE_TIME_FORMAT,
  PROCESS_TOKEN_BUCKET,
  SERVER_SHUTDOWN_STATE,
} from "@shared/constants";
```

**Available Constants:**

- `PROCESS_EXIT_CODE`: Exit codes for different scenarios
- `LOGGER_LOG_LEVEL`: Log level enums
- `DATE_TIME_FORMAT`: Standard date/time formats
- `PROCESS_TOKEN_BUCKET`: Token bucket configuration
- `SERVER_SHUTDOWN_STATE`: Server shutdown states

### Error Handling

#### Base Error

```typescript
import { BaseError } from "@shared/errors";

class CustomError extends BaseError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode);
  }
}
```

#### Authentication Error

```typescript
import { AuthenticationError } from "@shared/errors";

throw new AuthenticationError("Invalid token");
```

#### Token Bucket Rate Limiter Error

```typescript
import { TokenBucketRateLimiterServiceError } from "@shared/errors";

throw new TokenBucketRateLimiterServiceError("Rate limit exceeded");
```

### Middleware

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

#### Authentication

```typescript
import { authentication } from "@shared/middlewares/authentication";

app.use("/protected", authentication);
```

**Features:**

- Token validation
- User context injection
- Automatic error responses

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

const rateLimiter = createTokenBucketRateLimiter({
  tokensPerSecond: 10,
  bucketSize: 100,
  keyGenerator: (req) => req.user?.id || req.ip,
});

app.use("/api", rateLimiter);
```

**Features:**

- Configurable rate limits
- Per-user/IP limiting
- Redis-based storage
- Automatic token refill

### Utils

#### Date/Time Utilities

```typescript
import {
  formatDateTime,
  parseDateTime,
  isValidDateTime,
} from "@shared/utils/date-time";

const formatted = formatDateTime(new Date(), "YYYY-MM-DD HH:mm:ss");
const parsed = parseDateTime("2023-12-01 10:30:00");
const isValid = isValidDateTime("invalid-date");
```

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

#### Token Bucket Utilities

```typescript
import {
  processTokenBucket,
  createTokenBucketKey,
  getTokenBucketState,
} from "@shared/utils/token-bucket";

const result = await processTokenBucket({
  userId: "user123",
  tokensPerSecond: 10,
  bucketSize: 100,
});
```

**Features:**

- Redis-based token bucket
- Configurable rates and limits
- Automatic token refill
- Thread-safe operations

#### Lock Utilities

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

#### Exhaustive Switch

```typescript
import { exhaustiveSwitch } from "@shared/utils/exhaustive-switch";

type Status = "pending" | "completed" | "failed";

function handleStatus(status: Status) {
  switch (status) {
    case "pending":
      return "Processing...";
    case "completed":
      return "Done!";
    case "failed":
      return "Error occurred";
    default:
      return exhaustiveSwitch(status); // TypeScript error if missing cases
  }
}
```

**Features:**

- Type-safe switch statements
- Compile-time exhaustiveness checking
- Better error messages

## Testing

### Running Tests

```bash
npm test
```

### Mock Utilities

```typescript
import { createRedisMock, createRedlockMock } from "@shared/mocks";

// Use in tests
const redisMock = createRedisMock();
const redlockMock = createRedlockMock();
```
