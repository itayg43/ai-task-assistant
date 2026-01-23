# Testing Standards

Always follow these standards when writing unit or integration tests to maintain consistency across the codebase.

## File Naming

- Use the `.test.ts` extension for all test files (e.g., `operation.test.ts`).

## Lifecycle & Mocks

- **Imports**: Always destructure testing utilities from `vitest`:
  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
  ```
- **Mock Definition**: Define mock variables and shared options at the top of the `describe` block.
- **Type Safety**: Use `ReturnType<typeof vi.fn>` for properly typed mock variables:
  ```typescript
  let mockFunction: ReturnType<typeof vi.fn>;
  ```
- **State Management**:
  - Initialize/reset mocks and shared options in `beforeEach`.
  - Use `afterEach` to call `vi.clearAllMocks()` to ensure test isolation.
- **Mocking Hierarchy**:
  - **Services** should mock internal clients/repositories (e.g., `@clients/*`), not the underlying external SDKs.
  - **Clients** should be the only place where external SDKs (e.g., `openai`, `stripe`) are mocked.
- **Error Instance Checking**:
  - When a test needs to verify `instanceof ThirdPartyError`, centralize that Error class in a shared mock folder and ensure both the SDK mock and the test use the same class reference.

## Structure

- Use `describe` blocks to group tests for a specific function or class.
- Use `it` blocks for individual test cases.
- Follow the **Arrange-Act-Assert** pattern.
- For async functions, use `await expect(...).rejects.toThrow(...)` for error cases.

## Philosophy

- **Core Paths First**: Prioritize testing the main success and failure paths.
- **Infrastructure Resilience**: If the underlying infrastructure (like metrics recorders or error handlers) is already tested for resilience (e.g., wrapped in `try-catch`), avoid redundant testing of those failure modes in business logic tests.
- **Mock Interfaces**: Prefer mocking service/repository interfaces over complex internal logic when writing unit tests.
- **Avoid Multi-Layer Mocks**: In high-level tests, don't re-test validation logic that is already guaranteed by a lower-layer unit test.

## Mock Management

- **Centralized Mocks**: Keep complex structural mocks for third-party SDKs in a centralized location (e.g., `src/mocks/`) instead of redefining them in individual test files.
- **Mocking Patterns**:
  - **Direct Import Assertion (Preferred)**: For simple named exports (like metrics or utilities), define the mock inline and import the function to assert on it. This avoids hoisting scope issues.
    ```typescript
    // In setup
    vi.mock("@metrics/module", () => ({ recordSuccess: vi.fn() }));
    // In test
    import { recordSuccess } from "@metrics/module";
    expect(recordSuccess).toHaveBeenCalled();
    ```
  - **`vi.hoisted`**: Use `vi.hoisted` only when you need to retain a reference to a mock implementation _inside_ the factory itself (e.g. for default exports or complex objects).

## Observability & Metrics

- **Verify Wrappers**: When testing code wrapped in observability utilities (e.g., `withMetrics`), verify the wrapper is called (and its arguments) in **BOTH** success and failure scenarios.
- **Failures Count**: Explicitly verify that failure metrics recorders are called when operations fail.
- **Payload Validation**: Verify that metric values are realistic (e.g., `durationMs` should be `> 0` or `expect.any(Number)`).
