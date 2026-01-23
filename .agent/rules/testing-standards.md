# Testing Standards

This guide defines the "Golden Path" for writing tests. Follow these patterns to ensure type safety, consistency, and easy maintenance.

## 1. The Golden Template

Use this structure as a starting point for every new test file.

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Mocked } from "@shared/types";

// 1. Setup top-level mocks (outside describe)
vi.mock("@config/env", () => ({
  env: {
    /* mock env */
  },
}));
vi.mock("@metrics/module", () => ({ recordSuccess: vi.fn() })); // Pattern A: Simple Utility
vi.mock("@services/subject-service", () => ({ subjectHandler: vi.fn() })); // Pattern B: Complex Subject

// 2. Import mocked functions to assert on them directly
import { recordSuccess } from "@metrics/module";
import { subjectHandler } from "@services/subject-service";

describe("SubjectService (unit/integration)", () => {
  // 3. Shared test data (Scoped to this describe block)
  const mockSubjectId = "test-id-123";

  // 4. Define typed mock variables for complex overrides
  let mockedSubjectHandler: Mocked<typeof subjectHandler>;

  beforeEach(() => {
    // 5. Initialize typed mocks
    mockedSubjectHandler = vi.mocked(subjectHandler);
    mockedSubjectHandler.mockResolvedValue({ id: mockSubjectId } as any);
  });

  afterEach(() => {
    // 5. Mandatory isolation check
    vi.clearAllMocks();
  });

  it("should execute success path", async () => {
    // Arrange (using prefix pattern)
    mockedSubjectHandler.mockResolvedValueOnce({ id: 2 } as any);

    // Act
    // ... code that calls subjectHandler ...

    // Assert
    expect(mockedSubjectHandler).toHaveBeenCalled();
    expect(recordSuccess).toHaveBeenCalled(); // Direct Import Assertion
  });
});
```

## 2. The Three Golden Rules

### I. Strict Typing

- **NEVER** use `any` for mocks.
- **ALWAYS** use the `Mocked<typeof T>` utility type from `@shared/types`.
- This ensures that Vitest methods like `.mockResolvedValue()` and `.mockRejectedValue()` are type-safe.

### II. Mock Patterns

- **Direct Import Assertion (Preferred)**: For simple named exports (metrics, constants, pure utilities), define the mock at the top and import the function. Assert on the imported name directly.
- **Scoped Mock Variables (The `mocked` Prefix)**: For services, repositories, or handlers where you need to change behavior per test, create a `let mocked...` variable at the top of the `describe` block.
- **Scoping Test Data**: Derived constants (like `mockAiRequestId` from a central mock) should be defined inside the `describe` block or even specific `it` blocks to keep the global namespace clean and maintain clear context.
- **Avoid `vi.hoisted`**: Do not use `vi.hoisted` unless you are dealing with default exports or complex cyclic dependencies that cannot be handled by the above patterns.

### III. Strict Lifecycle

- **Isolation**: Every test must be independent. Call `vi.clearAllMocks()` in `afterEach`.
- **Reset**: Reset mock implementations (especially those with permanent failure mocks) in `beforeEach` to a healthy default state.

## 3. Practical Standards

### File Naming & Location

- Extension: `.test.ts` (e.g., `user-service.test.ts`).
- Location: Adjacent to the file being tested.

### Testing Observability

- **Business Logic Failures**: Always verify that a failure metric (e.g., `recordApiFailure`) is called when an operation fails.
- **Async Flows**: For webhook or callback handlers, verify that `200 OK` is returned even on internal failure to satisfy the caller, while checking that the failure metric was recorded.

### Mock Design

- **Mock Interfaces**: Mock high-level services or repositories. Avoid mocking internal logic or third-party SDKs directly (unless you are testing a dedicated "Client" wrapper).
- **Prisma Safety**: In integration tests, mock `@clients/prisma` to prevent the `PrismaClient` constructor from throwing errors due to missing environment variables during the test boot phase.
