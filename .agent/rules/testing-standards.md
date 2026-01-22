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

## Structure

- Use `describe` blocks to group tests for a specific function or class.
- Use `it` blocks for individual test cases.
- Follow the **Arrange-Act-Assert** pattern.
- For async functions, use `await expect(...).rejects.toThrow(...)` for error cases.

## Philosophy

- **Core Paths First**: Prioritize testing the main success and failure paths.
- **Infrastructure Resilience**: If the underlying infrastructure (like metrics recorders or error handlers) is already tested for resilience (e.g., wrapped in `try-catch`), avoid redundant testing of those failure modes in business logic tests.
- **Mock Interfaces**: Prefer mocking service/repository interfaces over complex internal logic when writing unit tests.
