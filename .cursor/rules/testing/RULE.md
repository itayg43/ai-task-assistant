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
- **Prompt evaluation tests**: `evals/level-*.test.ts` in prompt version directories (e.g., `prompts/core/v1/evals/level-1.test.ts`)
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
    mockDependency = createMockDependency();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("methodName", () => {
    it("should handle specific scenario", () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

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
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("Please define DATABASE_URL in .env.test");
    }
    prismaClient = createPrismaClient(dbUrl);
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

**When to use real schema validation:**

- Testing middleware that validates requests using fixed schemas (e.g., `executeCapabilityInputSchema`)
- The schema is part of the codebase being tested
- You want to ensure schema changes are caught by tests automatically
- Testing the integration between middleware and schema validation

**When to mock schemas:**

- Testing middleware that uses dynamic schemas from configuration (e.g., `capabilityConfig.inputSchema`)
- The schema comes from external sources or runtime configuration
- Testing error handling paths requires controlling schema behavior

**Example with real schema validation:**

```typescript
import { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capabilities } from "@capabilities";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";
import { mockAiServiceRequestId } from "@mocks/request-ids";

vi.mock("@capabilities");

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

  it("should call next() with ZodError when schema validation fails", () => {
    mockRequest.params!.capability = "invalid-capability" as any;

    validateExecutableCapability(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });
});
```

**Example with mocked schema (for dynamic schemas):**

```typescript
import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { validateCapabilityInput } from "@middlewares/validate-capability-input";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { AnyCapabilityConfig } from "@types";

describe("validateCapabilityInput", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;
  let mockInputSchema: z.ZodSchema<any>;
  let mockInputSchemaParseFunction: ReturnType<typeof vi.fn>;
  let mockCapabilityConfig: AnyCapabilityConfig;

  beforeEach(() => {
    mockInputSchemaParseFunction = vi.fn();
    mockInputSchema = {
      parse: mockInputSchemaParseFunction,
    } as unknown as z.ZodSchema<any>;

    mockCapabilityConfig = {
      ...mockParseTaskCapabilityConfig,
      inputSchema: mockInputSchema,
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
    expect(mockResponse.locals?.capabilityValidatedInput).toEqual(
      mockParseTaskValidatedInput
    );
    expect(mockNextFunction).toHaveBeenCalled();
  });
});
```

### Mock Value Files

**Create `*-mocks.ts` files for reusable mock data constants and objects.**

**When to use:**

- Mock data is reused across multiple test files
- Complex objects or data structures need to be shared
- Mock values are domain-specific (e.g., capability responses, API responses)

**Location:**

- Place in `mocks/` directories (e.g., `src/mocks/openai-mocks.ts`)
- Or alongside the code they mock (e.g., `src/capabilities/parse-task/parse-task-mocks.ts`)
- Use `@mocks/*` path aliases when importing

**Naming:**

- Use `*-mocks.ts` suffix (e.g., `openai-mocks.ts`, `parse-task-mocks.ts`, `tasks-mocks.ts`)
- Export constants with `mock` prefix: `mockOpenaiRequestId`, `mockParseTaskOutputCore`

**Example:**

```typescript
// src/mocks/openai-mocks.ts
export const mockOpenaiRequestId = "openai-request-id";
export const mockOpenaiTokenUsage = {
  input: 150,
  output: 135,
};

// src/capabilities/parse-task/parse-task-mocks.ts
import { mockOpenaiTokenUsage } from "@mocks/openai-mocks";

export const mockNaturalLanguage = "Submit Q2 report by next Friday";
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

**Difference from factories:**

- **Mock value files**: Export static constants/objects (`mockParseTaskOutputCore`)
- **Mock factories**: Export functions that create mocks (`createLoggerMock()`)

**Difference from test constants:**

- **Mock value files**: Complex domain objects, placed in `mocks/` or alongside code
- **Test constants**: Simple values, placed in `__tests__` directories

### Mock Factories

**Prefer factory functions over inline mocks for consistency.**

**Shared factories** (`@shared/src/mocks/*`):

- `createLoggerMock()` - Logger mocks
- `createPromClientMock()` - Prometheus client mocks
- `createMetricsRecorderMock()` - Metrics recorder mocks
- `createRedisClientMock()` - Redis client mocks

**Service-specific factories** (`@mocks/*`):

- `createMockPrismaClient()` - Prisma client mocks

**Example:**

```typescript
import { Mocked } from "@shared/types";
import { createLoggerMock } from "@shared/mocks/logger-mock";

let mockLogger: Mocked<typeof logger>;

beforeEach(() => {
  mockLogger = createLoggerMock();
});
```

### Express Response Mocks

Use `.mockReturnThis()` to enable method chaining:

```typescript
mockResponse = {
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
};
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

Use for multiple similar scenarios:

```typescript
// Option 1: forEach
const cases = [
  { description: "scenario A", input: valueA, expected: resultA },
  { description: "scenario B", input: valueB, expected: resultB },
];

cases.forEach(({ description, input, expected }) => {
  it(description, () => {
    expect(functionUnderTest(input)).toBe(expected);
  });
});

// Option 2: it.each (preferred for parameterized tests)
it.each(testCases)(
  "should parse $naturalLanguage",
  async ({ naturalLanguage, expected }) => {
    // test implementation
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
- `.toHaveBeenCalledWith(...)` - Function call assertions
- `.toHaveBeenCalledTimes(n)` - Call count assertions

**Example:**

```typescript
expect(mockNextFunction).toHaveBeenCalledWith(expect.any(BadRequestError));
expect(response.body.id).toEqual(expect.any(String));
expect(mockFunction).toHaveBeenCalledWith(
  expect.objectContaining({ key: "value" })
);
```

### Error Testing

- Test both error creation and handling
- Verify error messages are sanitized (no sensitive data)
- Test error status codes match expected values
- Use `expect.any(ErrorClass)` for error type verification

### Async Testing

- Always use `async/await` for async test functions
- Use `mockResolvedValue()` for async mocks
- Use `mockRejectedValue()` for error cases
- Ensure proper cleanup in `afterEach`/`afterAll`

## Test Organization

### Test Constants and Helpers

- Place test constants in `__tests__` directories (e.g., `__tests__/token-bucket-test-constants.ts`)
- Use descriptive names: `mockTokenBucketConfig`, `mockUserId`
- Export constants for reuse across test files
- Consider test data builders for complex objects

### Mock Data Organization

**Summary of mock/test data patterns:**

- **Mock value files** (`*-mocks.ts`): Reusable mock data constants and objects (detailed in Mock Value Files section above)
- **Mock factories**: Functions that create mocks (detailed in Mock Factories section above)
- **Test constants**: Simple values in `__tests__` directories (detailed in Test Constants and Helpers section above)

**General principles:**

- Keep mock data close to usage, extract common mocks to shared locations
- Use `@mocks/*` path aliases when importing mock value files

### Test File Organization

- Keep tests focused on single behavior or scenario
- Use descriptive test names that explain what is being tested
- Follow Arrange-Act-Assert pattern (Arrange: set up, Act: execute, Assert: verify)
- Test happy paths, error cases, and edge cases
- Separate unit tests from integration tests

## Test Configuration

### Unit Tests

- Config: `vitest.config.ts` at root or service level
- Excludes: `["**/*.integration.test.ts"]`
- Uses: `globals: true` for global test functions

### Integration Tests

**Database tests** (`vitest.db.config.ts`):

- Includes: `src/repositories/**/*.integration.test.ts`
- Runs sequentially: `pool: "forks"`, `singleFork: true`
- Timeout: `testTimeout: 30000`

**Prompt evaluation tests** (`vitest.prompts.config.ts`):

- Includes: `src/**/evals/**/*.test.ts`
- Timeout: `testTimeout: 30000`

**Always exclude:** `node_modules`, `dist`, and test-specific directories

### Running Tests

- Unit tests: `npm test` (runs all `.test.ts` files)
- Integration tests: `npm run test:db` or `npm run test:prompts`
- Service-specific: `npm test -w backend/services/{service-name}`
- CI mode: `npm test -- --run`

## Prompt Evaluation Tests

**Location:** `evals/` directories within prompt version folders  
**Naming:** `level-1.test.ts`, `level-2.test.ts`  
**Patterns:**

- Test actual AI responses against expected schemas
- Use `it.each()` with test cases for multiple scenarios
- Set fake timers for consistent date parsing tests
- Validate output against Zod schemas: `expect(() => schema.parse(output)).not.toThrow()`

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
    async ({ naturalLanguage, expected }) => {
      const { output } = await executeParseTask(naturalLanguage);
      expect(() => parseTaskOutputCoreSchema.parse(output)).not.toThrow();
    }
  );
});
```

## Best Practices

- **Isolation**: Each test should be independent and not affect others
- **Cleanup**: Clean up test data and mocks after each test (`vi.clearAllMocks()` only when mocks are used)
- **Clarity**: Test names should clearly describe what is being tested
- **Coverage**: Aim for high coverage but focus on testing critical paths
- **Speed**: Unit tests should be fast (<100ms each); integration tests may be slower but reasonable
- **Environment**: Integration tests require proper environment setup (`.env.test` files)
- **Error Messages**: Verify error messages don't leak sensitive information
- **Test Data**: Extract repeated test data to constants files or builders
