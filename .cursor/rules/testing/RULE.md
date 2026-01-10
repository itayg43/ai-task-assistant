---
description: "Testing standards and patterns for unit tests, integration tests, and test organization"
globs:
  - "**/*.test.ts"
  - "**/*.integration.test.ts"
  - "**/vitest.config.ts"
  - "**/vitest.*.config.ts"
alwaysApply: false
---

# Testing Standards

## Quick Reference

- **Unit tests**: `.test.ts` suffix, fast, mock dependencies
- **Integration tests**: `.integration.test.ts` suffix, use real services
- **Prompt evals**: `evals/level-*.test.ts` in prompt directories
- **Mock types**: Use `Mocked<T>` from `@shared/types`; fallback to `ReturnType<typeof vi.fn>` for Express `NextFunction`
- **Mock values**: Create `*-mocks.ts` files for reusable mock data constants
- **Cleanup**: `vi.clearAllMocks()` in `afterEach` only when mocks are used

## Test File Naming

- **Unit tests**: `.test.ts` suffix (e.g., `tasks-repository.test.ts`)
- **Integration tests**: `.integration.test.ts` suffix (e.g., `tasks-repository.integration.test.ts`)
- **Prompt evaluation tests**: `evals/level-*.test.ts` in prompt version directories
- Place test files next to source files or in `__tests__` directories

## Choosing Test Type

**Use unit tests when:**

- Testing pure functions or isolated logic
- Fast feedback is needed
- External dependencies can be mocked

**Use integration tests when:**

- Testing database operations
- Testing HTTP endpoints end-to-end
- Verifying interactions between services
- Testing with real external APIs (if stable)

## Test Structure

### Unit Tests

**Structure:**

- Use Vitest's `describe`, `it`, `expect`, `beforeEach`, `afterEach`
- Mock external dependencies using `vi.mock()` or mock factories
- Group related tests with nested `describe` blocks
- Follow Arrange-Act-Assert pattern

**Cleanup:**

- Use `vi.clearAllMocks()` in `afterEach` **only when mocks are used**
- Omit `afterEach` entirely if no mocks are needed

**Example with mocks:**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Mocked } from "@shared/types";

describe("componentName", () => {
  let mockDependency: Mocked<typeof dependency>;

  beforeEach(() => {
    mockDependency = vi.mocked(dependency);
    mockDependency.someMethod.mockReturnValue("default");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle specific scenario", () => {
    // Arrange - modify mocks if needed for this specific test
    mockDependency.someMethod.mockReturnValue("custom");

    // Act
    // Assert
  });
});
```

**Note:** For detailed mock setup patterns (including Express request/response mocks), see the **Mock Setup Pattern** section below.

**Example without mocks:**

```typescript
import { describe, expect, it } from "vitest";

describe("extractErrorInfo", () => {
  it("should extract status code and message", () => {
    const error = new BadRequestError("Test error");
    const result = extractErrorInfo(error);
    expect(result.status).toBe(StatusCodes.BAD_REQUEST);
    expect(result.message).toBe("Test error");
  });
});
```

### Integration Tests

**Structure:**

- Use `beforeAll` for setup (database connections, external services)
- Use `afterEach` for cleanup (delete test data)
- Use `afterAll` for teardown (disconnect services)
- Always validate required environment variables with clear error messages
- Use `supertest` (`request(app)`) for HTTP endpoint testing
- Mock middleware and external services at module level

**Example:**

```typescript
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../app";

describe("componentName (integration)", () => {
  let prismaClient: ReturnType<typeof createPrismaClient>;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("Please define DATABASE_URL in .env.test");
    }
    prismaClient = createPrismaClient(process.env.DATABASE_URL);
    await prismaClient.$connect();
  });

  afterEach(async () => {
    await prismaClient.task.deleteMany();
  });

  afterAll(async () => {
    await prismaClient.$disconnect();
  });

  it("should handle HTTP request", async () => {
    const response = await request(app)
      .post("/api/endpoint")
      .send({ data: "value" });
    expect(response.status).toBe(StatusCodes.OK);
  });
});
```

## Mock Patterns

### Mock Setup Pattern

**Define mocks directly in `beforeEach` and modify them in individual test cases when needed.**

**Pattern:**

- Declare mock variables at the top of the test suite: `let mockRequest: Partial<Request>;`
- Initialize mocks in `beforeEach` with default values
- Modify mocks directly in individual `it` blocks when test-specific changes are needed
- Avoid creating helper functions like `createMockResponse()` - define mocks directly

**Example:**

```typescript
describe("capabilitiesController (unit)", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: ReturnType<typeof vi.fn>;
  let mockedGetCapabilityConfig: Mocked<typeof getCapabilityConfig>;

  beforeEach(() => {
    mockedGetCapabilityConfig = vi.mocked(getCapabilityConfig);
    mockedGetCapabilityConfig.mockReturnValue(mockParseTaskCapabilityConfig);
    mockRequest = {};
    mockResponse = {
      locals: { requestId: mockAiServiceRequestId },
      status: vi.fn().mockReturnThis(), // Use .mockReturnThis() for method chaining
      json: vi.fn(),
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle default request", async () => {
    await executeCapability(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );
  });

  it("should handle modified request", async () => {
    mockRequest = { ...mockRequest, body: { customField: "value" } };
    await executeCapability(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );
  });
});
```

**Note:** For Express response mocks, use `.mockReturnThis()` to enable method chaining.

### Mock Type Guidelines

**Rule:** Use `Mocked<T>` from `@shared/types` for properly typed mocks. Use `ReturnType<typeof vi.fn>` only when `Mocked<T>` doesn't work (e.g., Express `NextFunction`).

```typescript
import { Mocked } from "@shared/types";
import { NextFunction } from "express";

// ✅ Prefer Mocked<T> for factory mocks
let mockLogger: Mocked<typeof logger>;
let mockDependency: Mocked<typeof dependency>;

// ✅ Use ReturnType<typeof vi.fn> for NextFunction
let mockNextFunction: ReturnType<typeof vi.fn>;

// ✅ TypeScript infers inline vi.fn() automatically
const mockFn = vi.fn().mockResolvedValue("success");
```

### Module Mocking

- Use `vi.mock()` at top level for module mocks
- Use `vi.hoisted()` when mocks need to be referenced in other mocks
- Use `vi.mocked()` for properly typed mock functions: `vi.mocked(functionName)`

**Example:**

```typescript
vi.mock("@utils/get-capability-config", () => ({
  getCapabilityConfig: vi.fn(),
}));

const { mockTokenBucketRateLimiter } = vi.hoisted(() => ({
  mockTokenBucketRateLimiter: vi.fn((_req, _res, next) => next()),
}));

vi.mock("@middlewares/token-bucket-rate-limiter", () => ({
  tokenBucketRateLimiter: { api: mockTokenBucketRateLimiter },
}));
```

### Schema Validation Testing

**Prefer real schema validation over mocking when testing middleware that uses fixed schemas.**

- **Use real schema validation**: For fixed schemas (e.g., `executeCapabilityInputSchema`) that are part of the codebase - ensures schema changes are caught automatically
- **Mock schemas**: For dynamic schemas from configuration (e.g., `capabilityConfig.inputSchema`) or when controlling schema behavior for error testing

**Example with real schema validation:**

```typescript
describe("validateExecutableCapability", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRequest = {
      params: { capability: CAPABILITY.PARSE_TASK },
      query: { pattern: CAPABILITY_PATTERN.SYNC },
    };
    mockResponse = { locals: { requestId: mockAiServiceRequestId } };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should validate successfully with real schema", () => {
    validateExecutableCapability(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    expect(mockResponse.locals!.capabilityValidatedQuery).toEqual({
      pattern: CAPABILITY_PATTERN.SYNC,
    });
    expect(mockNext).toHaveBeenCalledWith();
  });
});
```

**Example with mocked schema (for dynamic schemas):**

```typescript
describe("validateCapabilityInput", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: ReturnType<typeof vi.fn>;
  let mockInputSchemaParseFunction: ReturnType<typeof vi.fn>;
  let mockCapabilityConfig: AnyCapabilityConfig;

  beforeEach(() => {
    mockInputSchemaParseFunction = vi.fn();
    mockCapabilityConfig = {
      ...mockParseTaskCapabilityConfig,
      inputSchema: { parse: mockInputSchemaParseFunction } as z.ZodSchema<any>,
    };
    mockRequest = { body: {} };
    mockResponse = {
      locals: {
        requestId: mockAiServiceRequestId,
        capabilityConfig: mockCapabilityConfig,
      },
    };
    mockNextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should validate using capability config schema", async () => {
    mockInputSchemaParseFunction.mockReturnValue(mockParseTaskValidatedInput);
    await validateCapabilityInput(
      mockRequest as Request,
      mockResponse as Response,
      mockNextFunction
    );
    expect(mockInputSchemaParseFunction).toHaveBeenCalledWith(mockRequest.body);
  });
});
```

### Mock Value Files

**Create `*-mocks.ts` files for reusable mock data constants and objects.**

- **When to use**: Mock data reused across multiple test files, complex objects, domain-specific values
- **Location**: Place in `mocks/` directories or alongside code they mock; use `@mocks/*` path aliases
- **Naming**: Use `*-mocks.ts` suffix; export constants with `mock` prefix

**Example:**

```typescript
// src/mocks/openai-mocks.ts
export const mockOpenaiRequestId = "openai-request-id";
export const mockOpenaiTokenUsage = { input: 150, output: 135 };

// src/capabilities/parse-task/parse-task-mocks.ts
export const mockParseTaskOutputCore: ParseTaskOutputCore = {
  title: "Submit Q2 report",
  dueDate: "2024-01-19T23:59:59Z",
  category: "work",
  priority: { level: "high", score: 88, reason: "..." },
};

// Usage in tests
import { mockParseTaskOutputCore } from "@capabilities/parse-task/parse-task-mocks";
it("should handle parse task", () => {
  expect(functionUnderTest(mockParseTaskOutputCore)).toBe(expected);
});
```

**Differences:**

- **Mock value files**: Static constants/objects (`mockParseTaskOutputCore`) - complex domain objects
- **Mock factories**: Functions that create mocks (`createLoggerMock()`) - shared/reusable
- **Test constants**: Simple values in `__tests__` directories

### Mock Factories

**Use factory functions for shared/reusable mocks used across multiple test files.**

- **Mock factories**: For shared mocks (logger, Redis client) used across multiple test files
- **Direct setup in `beforeEach`**: For test-local mocks (Express request/response, test-specific dependencies)

**Available factories:**

- **Shared** (`@shared/src/mocks/*`): `createLoggerMock()`, `createPromClientMock()`, `createMetricsRecorderMock()`, `createRedisClientMock()`
- **Service-specific** (`@mocks/*`): `createMockPrismaClient()`

**Example:**

```typescript
import { Mocked } from "@shared/types";
import { createLoggerMock } from "@shared/mocks/logger-mock";

let mockLogger: Mocked<typeof logger>;

beforeEach(() => {
  mockLogger = createLoggerMock();
});
```

### Complex Mocks (`__mocks__` directories)

For complex mocks that don't resolve with path aliases:

```typescript
vi.mock("@middlewares/cors", () => {
  return import("../../middlewares/cors/__mocks__/cors");
});
```

## Testing Patterns

### Table-Driven Tests

Use `it.each()` for multiple similar scenarios:

```typescript
it.each(testCases)(
  "should parse $naturalLanguage",
  async ({ naturalLanguage, expected }) => {
    expect(functionUnderTest(naturalLanguage)).toBe(expected);
  }
);
```

### Fake Timers

For time-dependent code:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// Advance time in tests
vi.advanceTimersByTime(1000);
```

### Assertion Patterns

- `expect.any(ErrorClass)` - Error type checking
- `expect.any(String)` - Dynamic values (e.g., request IDs)
- `expect.objectContaining({ key: "value" })` - Partial object matching
- `.toHaveBeenCalledWith(...)`, `.toHaveBeenCalledTimes(n)` - Function call assertions

### Error Testing

- Test both error creation and handling; verify error messages are sanitized (no sensitive data)
- Test error status codes match expected values; use `expect.any(ErrorClass)` for type verification

### Async Testing

- Always use `async/await` for async test functions; use `mockResolvedValue()`/`mockRejectedValue()` for async mocks
- Ensure proper cleanup in `afterEach`/`afterAll`

## Test Organization

### Test Constants and Helpers

- Place test constants in `__tests__` directories; use descriptive names (`mockTokenBucketConfig`, `mockUserId`)
- Export constants for reuse across test files; consider test data builders for complex objects

### Mock Data Organization

- **Mock value files** (`*-mocks.ts`): Reusable mock data constants (see Mock Value Files section)
- **Mock factories**: Functions that create mocks (see Mock Factories section)
- **Test constants**: Simple values in `__tests__` directories (see Test Constants section)
- Keep mock data close to usage, extract common mocks to shared locations
- Use `@mocks/*` path aliases when importing mock value files

### Test File Organization

- Keep tests focused on single behavior; use descriptive test names
- Follow Arrange-Act-Assert pattern; test happy paths, error cases, and edge cases
- Separate unit tests from integration tests

## Test Configuration

### Unit Tests

- Config: `vitest.config.ts` at root or service level
- Excludes: `["**/*.integration.test.ts"]`
- Uses: `globals: true` for global test functions

### Integration Tests

- **Database tests** (`vitest.db.config.ts`): Includes `src/repositories/**/*.integration.test.ts`, runs sequentially (`pool: "forks"`, `singleFork: true`), timeout `30000`
- **Prompt evaluation tests** (`vitest.prompts.config.ts`): Includes `src/**/evals/**/*.test.ts`, timeout `30000`
- **Always exclude:** `node_modules`, `dist`, and test-specific directories

### Running Tests

- Unit tests: `npm test` (runs all `.test.ts` files)
- Integration tests: `npm run test:db` or `npm run test:prompts`
- Service-specific: `npm test -w backend/services/{service-name}`; CI mode: `npm test -- --run`

## Prompt Evaluation Tests

**Location:** `evals/` directories within prompt version folders; **Naming:** `level-1.test.ts`, `level-2.test.ts`

- Test actual AI responses against expected schemas; use `it.each()` for multiple scenarios
- Set fake timers for consistent date parsing; validate output: `expect(() => schema.parse(output)).not.toThrow()`

**Example:**

```typescript
describe("corePromptV1 - Level1Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(testCases)(
    "should parse $naturalLanguage",
    async ({ naturalLanguage }) => {
      const { output } = await executeParseTask(naturalLanguage);
      expect(() => parseTaskOutputCoreSchema.parse(output)).not.toThrow();
    }
  );
});
```

## Best Practices

- **Isolation**: Each test should be independent; cleanup test data and mocks (`vi.clearAllMocks()` only when mocks are used)
- **Clarity**: Test names should clearly describe what is being tested
- **Coverage**: Aim for high coverage but focus on critical paths
- **Speed**: Unit tests should be fast (<100ms each); integration tests may be slower but reasonable
- **Environment**: Integration tests require proper environment setup (`.env.test` files)
- **Error Messages**: Verify error messages don't leak sensitive information
- **Test Data**: Extract repeated test data to constants files or builders
