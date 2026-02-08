# Testing Standards

This file provides testing standards for this project. Follow these patterns when writing or modifying tests.

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

**MANDATORY**: Always call `vi.clearAllMocks()` in `afterEach`:

```typescript
afterEach(() => {
  vi.clearAllMocks();
});
```

For integration tests with database, reset state in `afterEach`:

```typescript
afterEach(async () => {
  await prismaClient.subtask.deleteMany();
  await prismaClient.task.deleteMany();
});
```

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

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Mock variables | Prefix with `mock` | `mockRedisClient`, `mockLogger` |
| Mock factories | `create<Thing>Mock` | `createLoggerMock()` |
| Test constants | Prefix with `mock` | `mockRequestId`, `mockUserId` |
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

### Express Request/Response Mocking

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

1. ✅ **ALWAYS** call `vi.clearAllMocks()` in `afterEach`
2. ✅ Use `vi.hoisted()` for mock factories
3. ✅ Test both success and error paths
4. ✅ Use existing mock factories from `@shared/mocks`
5. ✅ Follow naming conventions (mockXxx, createXxxMock)
6. ✅ Use `Mocked<T>` for type-safe assertions
7. ✅ Clean up database state in `afterEach` for integration tests
8. ✅ Use `beforeAll`/`afterAll` only for expensive setup (DB connections)
9. ✅ Never share mutable state between tests
10. ✅ Use Arrange-Act-Assert pattern
