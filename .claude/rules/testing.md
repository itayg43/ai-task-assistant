# Testing Standards

This file provides testing standards for this project. Follow these patterns when writing or modifying tests.

## Terminology

Understanding key terms used throughout this document:

- **Mock**: Test double of a dependency (function, service, client) - e.g., `vi.fn()`, mocked Redis client
- **Mock Data/Constants**: Static, reusable test values shared across tests - e.g., `mockUserId`, `mockRequestMetadata`
- **Test Data**: Runtime-created objects for specific test scenarios - e.g., `testMetadata`, `testPayload`
- **Mock Factory**: Function that creates configured mocks - e.g., `createLoggerMock()`, returns multiple related mocks
- **Hoisting**: Vitest mechanism (`vi.hoisted()`) for defining mocks before `vi.mock()` calls execute
- **Integration Test**: Tests components working together (controller + routes, repository + database)
- **Unit Test**: Tests a single function/module in isolation with mocked dependencies

## Before Running Tests

**ALWAYS run type-check before running tests** when you make code changes:

```bash
npm run type-check:ci  # Type-check all services
```

This catches TypeScript errors faster than waiting for test failures. Reference: See `CLAUDE.md` "Commands" section.

## Running Tests

**Standard tests** (unit + integration, excludes database/prompt tests):
```bash
npm test -- --run     # Single run (use this in automation/Claude)
```

**Specialized tests** (opt-in):
```bash
npm run test:db       # Database integration tests (real PostgreSQL)
npm run test:prompts  # Prompt evaluation tests
```

## Test Scope and Responsibilities (CRITICAL)

**Test behavior, not implementation details.** Each test should focus on its appropriate level of abstraction.

### Integration Tests: Test the Contract, Not the Implementation

Integration tests verify that components work together correctly. They should **NOT** verify internal implementation details of dependencies.

**✅ CORRECT - Test behavior and contract:**
```typescript
it("should record success metrics on successful task creation", async () => {
  const startTime = Date.now() - 1000;
  mockGetRequestMetadata.mockResolvedValue({ ...mockRequestMetadata, startTime });

  const response = await request(app).post(url).send(payload);

  // ✅ Verify the controller calls metrics with correct parameters
  expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
    TASKS_OPERATION.CREATE_TASK,
    startTime,
    mockTasksServiceRequestId,
  );
});
```

**❌ WRONG - Test implementation details:**
```typescript
it("should calculate duration correctly", async () => {
  const startTime = Date.now() - 1000;
  mockGetRequestMetadata.mockResolvedValue({ ...mockRequestMetadata, startTime });

  const response = await request(app).post(url).send(payload);

  // ❌ Testing how the metrics module calculates duration (implementation detail)
  const recordedStartTime = mockRecordTasksApiSuccess.mock.calls[0][1];
  const calculatedDuration = Date.now() - recordedStartTime;
  expect(calculatedDuration).toBeGreaterThan(900);
  expect(calculatedDuration).toBeLessThan(1100);
});
```

### Separation of Concerns

| Test Type | What to Test | What NOT to Test |
|-----------|--------------|------------------|
| **Integration (Controller)** | Does it call the right functions with the right parameters? Does it return correct status codes? | How the called functions calculate their results internally |
| **Integration (Repository)** | Does it perform correct database operations? Does it return expected data structures? | How Prisma Client works internally |
| **Unit (Utility Function)** | Does it calculate/transform correctly? Does it handle edge cases? | How dependencies work |

### Trust the Layers

- **Controller integration tests**: Verify the controller calls services/handlers with correct params
- **Service unit tests**: Verify the service logic and calculations
- **Utility unit tests**: Verify utility functions like duration calculation, formatting, etc.

**Don't re-test lower layers in higher-level tests.** If the metrics module has a unit test for duration calculation, the controller integration test should NOT verify the calculation again.

### Avoid Redundant Tests

**Don't test the same behavior with different input values** when there's no new behavior being verified. If a function works correctly for one valid input, it will work for any valid input of the same type.

**❌ Redundant - Testing same behavior with different values:**
```typescript
it("should parse metadata successfully", async () => {
  vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockRequestMetadata));
  const result = await getRequestMetadata(redis, requestId);
  expect(result).toEqual(mockRequestMetadata);
});

// ❌ Redundant - doesn't test new behavior, just different values
it("should handle different metadata values", async () => {
  const differentMetadata = { userId: 999, tokensReserved: 1500, ... };
  vi.mocked(redis.get).mockResolvedValue(JSON.stringify(differentMetadata));
  const result = await getRequestMetadata(redis, requestId);
  expect(result).toEqual(differentMetadata);  // Same assertion pattern
});
```

**✅ Test different behaviors, not just different values:**
```typescript
it("should parse metadata successfully", async () => {
  vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockRequestMetadata));
  const result = await getRequestMetadata(redis, requestId);
  expect(result).toEqual(mockRequestMetadata);
});

// ✅ Tests different behavior (error handling)
it("should return null on invalid JSON", async () => {
  vi.mocked(redis.get).mockResolvedValue("{ invalid json }");
  const result = await getRequestMetadata(redis, requestId);
  expect(result).toBeNull();
});
```

**When different inputs ARE valuable:**
- **Edge cases**: Empty arrays, null values, boundary conditions (max int, min int)
- **Error cases**: Invalid formats, missing required fields, type mismatches
- **Different code paths**: Optional fields present vs absent, different enum values triggering different logic
- **Complex types**: Nested objects with different structures, arrays with different lengths affecting logic

**When different inputs are redundant:**
- Same behavior with different primitive values (userId: 999 vs userId: 123)
- Re-verifying built-in functionality (JSON.parse works, array.map works)
- Re-checking fields already validated by `toEqual()` assertion
- Testing serialization/deserialization with no custom logic

### When to Test What

**❌ Bad layering:**
```typescript
// Controller integration test testing metrics implementation
expect(calculatedDuration).toBeGreaterThan(900);  // Metrics module's job

// Service test testing Prisma query building
expect(query).toEqual({ where: { ... } });  // Prisma's job
```

**✅ Good layering:**
```typescript
// Controller integration test
expect(mockMetricsService.record).toHaveBeenCalledWith(operation, startTime);

// Metrics service unit test (separate file)
expect(calculateDuration(startTime)).toBe(expectedDuration);
```

### Reference

See: `/backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts` - Controller verifies metrics are called, doesn't verify duration calculation

## Mock Hoisting Pattern

**ALWAYS use `vi.hoisted()` for mock factories** before `vi.mock()` calls:

```typescript
const { mockFunction } = vi.hoisted(() => ({
  mockFunction: vi.fn(),
}));

vi.mock("@module/path", () => ({
  functionName: mockFunction,
}));
```

Reference: `/backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.integration.test.ts:13-19`

## Test Isolation (CRITICAL)

**MANDATORY cleanup checklist in `afterEach`:**

```typescript
afterEach(() => {
  vi.clearAllMocks();        // Clear all mocked functions
  vi.useRealTimers();        // Restore real timers if using fake timers
  // Restore any other mocked state
});
```

For integration tests with database, reset state in `afterEach`:

```typescript
afterEach(async () => {
  await prismaClient.subtask.deleteMany();
  await prismaClient.task.deleteMany();
  vi.clearAllMocks();
});
```

**Common cleanup tasks:**
- ✅ Clear mocks: `vi.clearAllMocks()`
- ✅ Restore timers: `vi.useRealTimers()` (if using `vi.useFakeTimers()`)
- ✅ Reset database state (integration tests only)
- ✅ Restore environment variables (if mocked)

## Mock Factories

Use existing mock factories from `@shared/mocks/`:

- `createLoggerMock()` - Returns `{ mockLogger, mockLoggerDebug, mockLoggerInfo, mockLoggerWarn, mockLoggerError }`
- `createRedisClientMock()` - Returns mocked Redis client
- `createRedlockClientMock()` - Returns mocked Redlock client
- `createMockPrismaClient()` - Returns mocked Prisma client (tasks service)

**Pattern**:
```typescript
import { createLoggerMock } from "@shared/mocks/logger-mock";

const { mockLoggerDebug, mockLoggerError } = vi.hoisted(() => createLoggerMock());

vi.mock("@shared/config/create-logger", () => ({
  createLogger: vi.fn(() => ({
    debug: mockLoggerDebug,
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));
```

## Shared Mock Data and Helpers

**ALWAYS reuse mock data and helpers to reduce duplication:**

### Available Shared Mocks

**Mock Factories (in `@shared/mocks/`):**
- `createLoggerMock()` - Logger with all methods
- `createRedisClientMock()` - Redis client
- `createRedlockClientMock()` - Redlock client

**Test Helpers:**
- `waitForBackgroundTasks()` - Helper for fire-and-forget promises (from `@shared/test-utils/`)

**Mock Data Constants:**
- `@mocks/tasks-mocks` - Task-related mock data and constants
- `@mocks/token-usage-mocks` - RequestMetadata and token usage constants

### Important: Hoisting Limitation

⚠️ **You CANNOT call imported factory functions inside `vi.hoisted()`** due to import hoisting order.

**❌ This will fail:**
```typescript
import { createLoggerMock } from "@shared/mocks/logger-mock";

// ERROR: Cannot access import before initialization
const { mockLogger } = vi.hoisted(() => createLoggerMock());
```

**✅ Instead, define mocks inline in hoisted blocks:**
```typescript
// For integration tests that use vi.mock()
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

**The shared mock factory files serve as:**
1. **Documentation** - Reference for what mocks should look like
2. **Consistency** - Ensures all tests mock the same way
3. **Unit tests** - Can be used in non-hoisted contexts (e.g., `beforeEach`)

### When to Create New Shared Mocks

Follow this decision tree:

1. **Used in 1 test file only** → Define locally in that test
2. **Used in 2+ test files in same service** → Extract to service-level `@mocks/`
3. **Used across multiple services** → Extract to `@shared/mocks/` or `@shared/test-utils/`

### Examples

**Using shared test helpers:**
```typescript
import { waitForBackgroundTasks } from "@shared/test-utils";

it("should handle background operations", async () => {
  const response = await makeRequest();
  await waitForBackgroundTasks();
  expect(mockBackgroundFunction).toHaveBeenCalled();
});
```

**Using service-specific mock data:**
```typescript
import {
  mockRequestMetadata,
  mockTokenUsageRequestId,
} from "@mocks/token-usage-mocks";

it("should store request metadata", async () => {
  await storeRequestMetadata(redis, mockTokenUsageRequestId, mockRequestMetadata);
  expect(redis.setex).toHaveBeenCalledWith(
    expect.any(String),
    3600,
    JSON.stringify(mockRequestMetadata)
  );
});
```

**Defining inline mocks for middleware:**
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

## Type Assertions

Use `Mocked<T>` type from `@shared/types` for type-safe assertions:

```typescript
import type { Mocked } from "@shared/types";

let mockedFunction: Mocked<typeof originalFunction>;

beforeEach(() => {
  mockedFunction = vi.mocked(originalFunction);
  mockedFunction.mockResolvedValue(mockValue);
});
```

For non-hoisted mocks, use `vi.mocked()` for method calls:
```typescript
vi.mocked(mockRedisClient.get).mockResolvedValue("data");
```

## Use Real Constants, Not Hardcoded Values (CRITICAL)

**ALWAYS import and use actual constants from source code** instead of hardcoding values in tests.

**Why this matters:**
- **Single source of truth**: Constants defined once, used everywhere
- **Refactoring safety**: Change constant value → tests still pass if behavior is correct
- **Maintainability**: No need to update tests when configuration changes
- **Discoverability**: Tests show where values come from

**❌ WRONG - Hardcoded values:**
```typescript
it("should store metadata with TTL", async () => {
  await storeMetadata(redis, id, data);

  expect(redis.setex).toHaveBeenCalledWith(
    `request-metadata:${id}`,  // ❌ Hardcoded key format
    30,                          // ❌ Magic number
    JSON.stringify(data),
  );
});
```

**✅ CORRECT - Use real constants and functions:**
```typescript
import {
  getRequestMetadataKey,
  REQUEST_METADATA_TTL_SECONDS
} from "@services/token-usage-service";

it("should store metadata with TTL", async () => {
  await storeMetadata(redis, id, data);

  expect(redis.setex).toHaveBeenCalledWith(
    getRequestMetadataKey(id),      // ✅ Use actual function
    REQUEST_METADATA_TTL_SECONDS,   // ✅ Use actual constant
    JSON.stringify(data),
  );
});
```

**Pattern: Export constants for testing**

If a constant isn't already exported, export it from the module:

```typescript
// source-module.ts
export const RATE_LIMIT_WINDOW_MS = 60000;  // Export for tests
export const API_TIMEOUT_MS = 5000;          // Export for tests

const buildCacheKey = (id: string) => `cache:${id}`;  // Private helper
export { buildCacheKey };  // Export so tests can use it
```

**What to export:**
- Configuration constants (TTLs, timeouts, limits)
- Key/ID formatting functions
- Enum values and string constants
- Validation rules and boundaries

**What NOT to hardcode in tests:**
- TTL values → import `REQUEST_METADATA_TTL_SECONDS`
- Key formats → use `getRequestMetadataKey()` function
- Rate limits → import `RATE_LIMIT_REQUESTS_PER_WINDOW`
- Timeouts → import `REDIS_LOCK_TTL_MS`
- Status codes → import from `http-status-codes` package
- Error messages → import constant or use pattern matching

### Reference

See: `/backend/services/tasks/src/services/token-usage-service/request-metadata.test.ts` - Uses `REQUEST_METADATA_TTL_SECONDS` and `getRequestMetadataKey()` instead of hardcoded `30` and string templates

## Type-Safe Test Data (CRITICAL)

**ALWAYS use typed mock data instead of inline objects** for type safety and maintainability.

### Pattern: Spread from Base Mocks

When you need test-specific variations of mock data, use the spread operator with type annotations:

**✅ CORRECT - Type-safe with reusable mocks:**
```typescript
import { mockRequestMetadata } from "@mocks/token-usage-mocks";
import type { RequestMetadata } from "@shared/types";

it("should handle request with custom timestamp", async () => {
  const testMetadata: RequestMetadata = {
    ...mockRequestMetadata,
    userId: mockUserId,
    startTime: Date.now() - 1000,
  };
  mockGetRequestMetadata.mockResolvedValue(testMetadata);

  // In assertions, use the typed object
  expect(mockFunction).toHaveBeenCalledWith(testMetadata, /* other args */);
});
```

**❌ WRONG - Inline objects without types:**
```typescript
it("should handle request", async () => {
  // No type safety, easy to miss required fields or typos
  mockGetRequestMetadata.mockResolvedValue({
    userId: mockUserId,
    tokensReserved: 200,
    windowStartTimestamp: Date.now(),
    startTime: Date.now(),
    serviceName: "tasks",
    rateLimiterName: "openai-token-usage",
  });

  // Duplicated inline object in assertion
  expect(mockFunction).toHaveBeenCalledWith({
    userId: mockUserId,
    tokensReserved: 200,
    // ... duplicated fields
  });
});
```

### Test-Local Constants

Define test-local constants when values need to match test environment configuration:

```typescript
describe("webhooksController", () => {
  const mockLockTtlMs = 10000; // Matches env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS

  it("should use correct lock TTL", async () => {
    expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      mockRequestId,
      testMetadata,
      150,
      mockLockTtlMs, // Use defined constant, not magic number or mismatched import
    );
  });
});
```

### Benefits

1. **Compile-time safety**: TypeScript catches missing fields or typos
2. **DRY**: Reuse base mocks, override only what's needed
3. **Maintainability**: Type changes propagate automatically
4. **Readability**: Clear what differs from the base mock
5. **Consistency**: Same pattern across all tests

### Reference

See: `/backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Mock variables | Prefix with `mock` | `mockRedisClient`, `mockLogger` |
| Mock factories | `create<Thing>Mock` | `createLoggerMock()` |
| Test constants | Prefix with `mock` | `mockRequestId`, `mockUserId` |
| Test-specific data | `test<TypeName>` | `testMetadata`, `testPayload` |
| Test descriptions | Start with "should" | `it("should acquire lock...")` |

## Test Structure

### Unit Tests

```typescript
describe("moduleName", () => {
  let mockDependency: DependencyType;
  let mockedFunction: Mocked<typeof externalFunction>;

  beforeEach(() => {
    mockDependency = createMockDependency();
    mockedFunction = vi.mocked(externalFunction);
    mockedFunction.mockResolvedValue(mockValue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle success case", async () => {
    // Arrange
    const input = mockInput;

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toEqual(expectedOutput);
    expect(mockedFunction).toHaveBeenCalledWith(expectedArgs);
  });

  it("should handle error case", async () => {
    const mockError = new Error("Test error");
    mockedFunction.mockRejectedValue(mockError);

    await expect(functionUnderTest()).rejects.toThrow(mockError);
  });
});
```

### Integration Tests (Database)

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
    // Clean up test data
    await prismaClient.model.deleteMany();
  });

  afterAll(async () => {
    await prismaClient.$disconnect();
  });

  it("should perform database operation", async () => {
    // Test with real database
  });
});
```

Reference: `/backend/services/tasks/src/repositories/tasks-repository/tasks-repository.integration.test.ts`

### Integration Tests (Express Controllers)

```typescript
import request from "supertest";
import { app } from "@app";

describe("controller (integration)", () => {
  const executeRequest = async (url: string, body: object) => {
    return await request(app).post(url).send(body);
  };

  beforeEach(() => {
    // Setup mocks for external dependencies
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with correct response", async () => {
    const response = await executeRequest("/api/endpoint", { data: "test" });
    expect(response.status).toBe(200);
  });
});
```

Reference: `/backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.integration.test.ts`

## Table-Driven Tests

Use `it.each()` for testing multiple scenarios:

```typescript
it.each([
  {
    description: "should handle case 1",
    input: value1,
    expected: result1,
  },
  {
    description: "should handle case 2",
    input: value2,
    expected: result2,
  },
])("$description", async ({ input, expected }) => {
  const result = await functionUnderTest(input);
  expect(result).toEqual(expected);
});
```

Reference: `/backend/shared/src/utils/with-lock/with-lock.test.ts:38-142`

## Special Patterns

### Testing Fire-and-Forget Operations

When testing async operations triggered with `void` keyword (fire-and-forget), use `waitForBackgroundTasks()`:

```typescript
import { waitForBackgroundTasks } from "@shared/test-utils";

it("should reconcile tokens in background", async () => {
  // Act - triggers void reconcileTokenUsage(...)
  const response = await request(app).post("/endpoint").send(payload);

  // Wait for background promises to settle
  await waitForBackgroundTasks();

  // Assert - now safe to verify background operations
  expect(mockReconcileTokenUsage).toHaveBeenCalled();
  expect(mockMetricsRecording).toHaveBeenCalled();
});
```

**Pattern**: Act → `waitForBackgroundTasks()` → Assert

Reference: `/backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.integration.test.ts`

### Testing Async Errors and Rejections

Test promises that reject using `rejects` matcher:

```typescript
it("should handle async errors", async () => {
  const mockError = new Error("Database connection failed");
  mockDatabaseClient.query.mockRejectedValue(mockError);

  await expect(functionUnderTest()).rejects.toThrow(mockError);
  await expect(functionUnderTest()).rejects.toThrow("Database connection failed");
});
```

For functions that should NOT throw:

```typescript
it("should gracefully handle errors", async () => {
  mockExternalApi.fetch.mockRejectedValue(new Error("API down"));

  // Should not throw, returns fallback value
  await expect(functionUnderTest()).resolves.toBe(null);
});
```

### Express Request/Response Mocking (Unit Tests)

**Note**: Use this pattern for **unit testing middleware or utilities**, NOT for controller integration tests. Controller integration tests should use `supertest` with the full Express app.

```typescript
let mockRequest: Partial<Request>;
let mockResponse: Partial<Response>;

beforeEach(() => {
  mockRequest = { body: {} };
  mockResponse = {
    status: vi.fn().mockReturnThis(),  // For method chaining
    json: vi.fn(),
    locals: { requestId: "test-id" },
  };
});

// Assertions
expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
expect(mockResponse.json).toHaveBeenCalledWith({ data: "result" });
```

### Fake Timers

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("should measure duration", async () => {
  vi.setSystemTime(0);
  vi.advanceTimersByTime(100);
  // assertions
});
```

## Critical Rules

### Test Quality
1. ✅ **Test behavior, NOT implementation details** - verify the contract, not internal calculations
2. ✅ **Trust the layers** - don't re-test lower-level logic in higher-level tests
3. ✅ **Avoid redundant tests** - don't test the same behavior with different input values when no new code path is exercised
4. ✅ Test both success and error paths

### Test Isolation and Cleanup
4. ✅ **ALWAYS** call `vi.clearAllMocks()` in `afterEach`
5. ✅ Clean up database state in `afterEach` for integration tests
6. ✅ Use `beforeAll`/`afterAll` only for expensive setup (DB connections)
7. ✅ Never share mutable state between tests

### Type Safety and Constants
8. ✅ **ALWAYS** import and use real constants from source code (TTLs, key functions, limits) - NEVER hardcode values in tests
9. ✅ **ALWAYS** type-annotate test data objects (e.g., `const testMetadata: RequestMetadata = ...`)
10. ✅ **Spread from base mocks**, override only what's needed (e.g., `{ ...mockRequestMetadata, startTime }`)
11. ✅ **NEVER** build inline objects without types in setup or assertions
12. ✅ Use `Mocked<T>` from `@shared/types` for type-safe mock assertions

### Mocking Patterns
13. ✅ Use `vi.hoisted()` for mocks used in `vi.mock()` - define inline, don't import factories
14. ✅ Use existing shared mocks from `@shared/mocks` for reference/consistency
15. ✅ Follow naming conventions: `mockXxx` (mocks), `createXxxMock` (factories), `testXxx` (test-specific data)

### Test Structure
16. ✅ Use Arrange-Act-Assert pattern
17. ✅ Run `npm run type-check:ci` before running tests (catches errors faster)
