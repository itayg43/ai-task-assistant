# Testing Standards

Follow these rules when writing or modifying tests. For detailed examples and templates, read `.claude/testing-examples.md`.

## Commands

Run `npm run type-check:ci` before tests when making code changes. Run `npm test -- --run` for standard tests. See `CLAUDE.md` for all test commands.

## Test Scope and Responsibilities

**Test behavior, not implementation details.** Each test level should only verify its own contract:

| Test Type | What to Test | What NOT to Test |
|-----------|--------------|------------------|
| **Integration (Controller)** | Calls right functions with right params, returns correct status codes | How called functions calculate results internally |
| **Integration (Repository)** | Correct DB operations, expected data structures | Prisma internals |
| **Unit (Utility)** | Calculations, transformations, edge cases | How dependencies work |

**Trust the layers** - don't re-test lower-level logic in higher-level tests.

**Avoid redundant tests** - don't test the same behavior with different input values unless it exercises a new code path. Different inputs are valuable for: edge cases, error cases, different code paths, complex types. They're redundant for: different primitive values, re-verifying built-in functionality.

## Mocking Rules

**Hoisting**: Always use `vi.hoisted()` for mocks used in `vi.mock()`. Define mocks inline in hoisted blocks - you CANNOT call imported factory functions inside `vi.hoisted()` due to import order.

**Available mock factories** (in `@shared/mocks/`): `createLoggerMock()`, `createRedisClientMock()`, `createRedlockClientMock()`, `createMockPrismaClient()`. Use for reference/consistency; define inline in `vi.hoisted()` for integration tests.

**Available test helpers**: `waitForBackgroundTasks()` from `@shared/test-utils/` for fire-and-forget operations (pattern: Act -> `waitForBackgroundTasks()` -> Assert).

**Mock data constants**: `@mocks/tasks-mocks`, `@mocks/token-usage-mocks`.

**When to create shared mocks**: 1 test file -> local. 2+ files in same service -> `@mocks/`. Cross-service -> `@shared/mocks/`.

## Type Safety and Constants

- **Always** import real constants from source code (TTLs, key functions, limits) - never hardcode values in tests
- **Always** type-annotate test data objects (e.g., `const testMetadata: RequestMetadata = { ... }`)
- **Spread from base mocks**, override only what's needed (e.g., `{ ...mockRequestMetadata, startTime }`)
- **Never** build inline objects without types in setup or assertions
- Use `Mocked<T>` from `@shared/types` for type-safe mock assertions
- Export constants/key-formatting functions from source modules so tests can use them

## Test Isolation

**Mandatory `afterEach` cleanup:**
- `vi.clearAllMocks()` (always)
- `vi.useRealTimers()` (if using fake timers)
- Database cleanup for integration tests (deleteMany)
- Use `beforeAll`/`afterAll` only for expensive setup (DB connections)

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Mock variables | `mock` prefix | `mockRedisClient`, `mockLogger` |
| Mock factories | `create<Thing>Mock` | `createLoggerMock()` |
| Test constants | `mock` prefix | `mockRequestId`, `mockUserId` |
| Test-specific data | `test` prefix | `testMetadata`, `testPayload` |
| Test descriptions | Start with "should" | `it("should acquire lock...")` |

## Structure

- Use Arrange-Act-Assert pattern
- Use `it.each()` for table-driven tests with multiple scenarios
- Controller integration tests: use `supertest` with the full Express app
- Unit tests for middleware/utilities: mock `Request`/`Response` directly
- Test both success and error paths
