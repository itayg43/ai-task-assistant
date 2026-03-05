# Testing Examples & Templates

Detailed examples for testing patterns. The concise rules are in `.claude/rules/testing.md`.

## Conventions

### Naming

| Type | Convention | Example |
|------|------------|---------|
| Mock variables | `mock` prefix | `mockRedisClient`, `mockLogger` |
| Mock factories | `create<Thing>Mock` | `createLoggerMock()` |
| Test constants | `mock` prefix | `mockRequestId`, `mockUserId` |
| Test-specific data | `test` prefix | `testMetadata`, `testPayload` |
| Test descriptions | Start with "should" | `it("should acquire lock...")` |

### Structure

- Use Arrange-Act-Assert pattern
- Use `it.each()` for table-driven tests with multiple scenarios
- Controller integration tests: use `supertest` with the full Express app
- Unit tests for middleware/utilities: mock `Request`/`Response` directly
- Test both success and error paths

## Mock Hoisting

**Correct - inline mocks in `vi.hoisted()`:**
```typescript
const { mockFunction } = vi.hoisted(() => ({
  mockFunction: vi.fn(),
}));

vi.mock("@module/path", () => ({
  functionName: mockFunction,
}));
```

**Wrong - importing factory in hoisted (fails due to import order):**
```typescript
import { createLoggerMock } from "@shared/mocks/logger-mock";
// ERROR: Cannot access import before initialization
const { mockLogger } = vi.hoisted(() => createLoggerMock());
```

**Logger mock pattern:**
```typescript
const { mockLoggerDebug, mockLoggerError } = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@shared/config/create-logger", () => ({
  createLogger: vi.fn(() => ({
    debug: mockLoggerDebug,
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));
```

**Middleware mock pattern:**
```typescript
const { mockTokenBucketRateLimiter } = vi.hoisted(() => ({
  mockTokenBucketRateLimiter: vi.fn((_req, _res, next) => next()),
}));

vi.mock("@middlewares/token-bucket-rate-limiter", () => ({
  tokenBucketRateLimiter: {
    api: mockTokenBucketRateLimiter,
  },
}));
```

Reference: `/backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.integration.test.ts`

## Test Scope: Contract vs Implementation

**Correct - test the contract:**
```typescript
it("should record success metrics on successful task creation", async () => {
  const startTime = Date.now() - 1000;
  mockGetRequestMetadata.mockResolvedValue({ ...mockRequestMetadata, startTime });
  const response = await request(app).post(url).send(payload);

  expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
    TASKS_OPERATION.CREATE_TASK,
    startTime,
    mockTasksServiceRequestId,
  );
});
```

**Wrong - testing implementation details of a dependency:**
```typescript
it("should calculate duration correctly", async () => {
  const startTime = Date.now() - 1000;
  mockGetRequestMetadata.mockResolvedValue({ ...mockRequestMetadata, startTime });
  const response = await request(app).post(url).send(payload);

  // Testing how the metrics module calculates duration (not this test's job)
  const recordedStartTime = mockRecordTasksApiSuccess.mock.calls[0][1];
  const calculatedDuration = Date.now() - recordedStartTime;
  expect(calculatedDuration).toBeGreaterThan(900);
});
```

Reference: `/backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`

## Avoiding Redundant Tests

**Wrong - same behavior, different values:**
```typescript
it("should parse metadata successfully", async () => {
  vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockRequestMetadata));
  const result = await getRequestMetadata(redis, requestId);
  expect(result).toEqual(mockRequestMetadata);
});

// Redundant - doesn't test new behavior
it("should handle different metadata values", async () => {
  const differentMetadata = { userId: 999, tokenUsage: { reserved: 1500, windowStart: Date.now() }, ... };
  vi.mocked(redis.get).mockResolvedValue(JSON.stringify(differentMetadata));
  const result = await getRequestMetadata(redis, requestId);
  expect(result).toEqual(differentMetadata);
});
```

**Correct - different behaviors:**
```typescript
it("should parse metadata successfully", async () => { /* ... */ });

// Tests a different code path (error handling)
it("should return null on invalid JSON", async () => {
  vi.mocked(redis.get).mockResolvedValue("{ invalid json }");
  const result = await getRequestMetadata(redis, requestId);
  expect(result).toBeNull();
});
```

## Using Real Constants

**Wrong - hardcoded values:**
```typescript
expect(redis.setex).toHaveBeenCalledWith(
  `request-metadata:${id}`,  // Hardcoded key format
  30,                          // Magic number
  JSON.stringify(data),
);
```

**Correct - imported constants:**
```typescript
import { getRequestMetadataKey, REQUEST_METADATA_TTL_SECONDS } from "@services/token-usage-service";

expect(redis.setex).toHaveBeenCalledWith(
  getRequestMetadataKey(id),
  REQUEST_METADATA_TTL_SECONDS,
  JSON.stringify(data),
);
```

Reference: `/backend/services/tasks/src/services/token-usage-service/request-metadata.test.ts`

## Type-Safe Test Data

**Correct - typed, spread from base mocks:**
```typescript
import { mockRequestMetadata } from "@mocks/token-usage-mocks";
import type { RequestMetadata } from "@shared/types";

const testMetadata: RequestMetadata = {
  ...mockRequestMetadata,
  userId: mockUserId,
  startTime: Date.now() - 1000,
};
mockGetRequestMetadata.mockResolvedValue(testMetadata);
expect(mockFunction).toHaveBeenCalledWith(testMetadata);
```

**Wrong - inline objects without types:**
```typescript
mockGetRequestMetadata.mockResolvedValue({
  userId: mockUserId,
  tokenUsage: { reserved: 200, windowStart: Date.now() },
  startTime: Date.now(),
  serviceName: "tasks",
  rateLimiterName: "openai-token-usage",
});
```

**Test-local constants for env-dependent values:**
```typescript
describe("webhooksController", () => {
  const mockLockTtlMs = 10000; // Matches env config

  it("should use correct lock TTL", async () => {
    expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object),
      mockRequestId, testMetadata, 150, mockLockTtlMs,
    );
  });
});
```

Reference: `/backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`

## Type Assertions

```typescript
import type { Mocked } from "@shared/types";

let mockedFunction: Mocked<typeof originalFunction>;

beforeEach(() => {
  mockedFunction = vi.mocked(originalFunction);
  mockedFunction.mockResolvedValue(mockValue);
});

// For non-hoisted mocks:
vi.mocked(mockRedisClient.get).mockResolvedValue("data");
```

## Test Structure Templates

### Unit Test
```typescript
describe("moduleName", () => {
  let mockedFunction: Mocked<typeof externalFunction>;

  beforeEach(() => {
    mockedFunction = vi.mocked(externalFunction);
    mockedFunction.mockResolvedValue(mockValue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle success case", async () => {
    const result = await functionUnderTest(mockInput);
    expect(result).toEqual(expectedOutput);
    expect(mockedFunction).toHaveBeenCalledWith(expectedArgs);
  });

  it("should handle error case", async () => {
    mockedFunction.mockRejectedValue(new Error("Test error"));
    await expect(functionUnderTest()).rejects.toThrow("Test error");
  });
});
```

### Integration Test (Database)
```typescript
describe("repository (integration)", () => {
  let prismaClient: ReturnType<typeof createPrismaClient>;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("Please define DATABASE_URL in .env.test");
    prismaClient = createPrismaClient(dbUrl);
    await prismaClient.$connect();
  });

  afterEach(async () => {
    await prismaClient.model.deleteMany();
  });

  afterAll(async () => {
    await prismaClient.$disconnect();
  });

  it("should perform database operation", async () => { /* ... */ });
});
```

Reference: `/backend/services/tasks/src/repositories/tasks-repository/tasks-repository.integration.test.ts`

### Integration Test (Express Controller)
```typescript
import request from "supertest";
import { app } from "@app";

describe("controller (integration)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with correct response", async () => {
    const response = await request(app).post("/api/endpoint").send({ data: "test" });
    expect(response.status).toBe(200);
  });
});
```

Reference: `/backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.integration.test.ts`

## Table-Driven Tests

```typescript
it.each([
  { description: "should handle case 1", input: value1, expected: result1 },
  { description: "should handle case 2", input: value2, expected: result2 },
])("$description", async ({ input, expected }) => {
  const result = await functionUnderTest(input);
  expect(result).toEqual(expected);
});
```

Reference: `/backend/shared/src/utils/with-lock/with-lock.test.ts:38-142`

## Special Patterns

### Fire-and-Forget Operations
```typescript
import { waitForBackgroundTasks } from "@shared/test-utils";

it("should reconcile tokens in background", async () => {
  const response = await request(app).post("/endpoint").send(payload);
  await waitForBackgroundTasks();
  expect(mockReconcileTokenUsage).toHaveBeenCalled();
});
```

Reference: `/backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`

### Async Errors and Rejections
```typescript
// Should throw
await expect(functionUnderTest()).rejects.toThrow(mockError);

// Should NOT throw, returns fallback
await expect(functionUnderTest()).resolves.toBe(null);
```

### Express Request/Response Mocking (Unit Tests Only)
For middleware/utilities, not controller integration tests (use supertest for those):
```typescript
let mockRequest: Partial<Request>;
let mockResponse: Partial<Response>;

beforeEach(() => {
  mockRequest = { body: {} };
  mockResponse = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    locals: { requestId: "test-id" },
  };
});
```

### Fake Timers
```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it("should measure duration", async () => {
  vi.setSystemTime(0);
  vi.advanceTimersByTime(100);
});
```
