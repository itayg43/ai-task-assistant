import { vi } from "vitest";

/**
 * Creates all token usage service mock functions.
 * Use this factory to ensure consistent mocking across integration tests.
 *
 * @example
 * ```typescript
 * const { mockStoreRequestMetadata, mockReconcileTokenUsageFromCallback } =
 *   vi.hoisted(() => createTokenUsageServiceMock());
 *
 * vi.mock("@services/token-usage-service", () => ({
 *   storeRequestMetadata: mockStoreRequestMetadata,
 *   reconcileTokenUsageFromCallback: mockReconcileTokenUsageFromCallback,
 * }));
 *
 * // In test: verify metadata storage was called
 * await waitForBackgroundTasks();
 * expect(mockStoreRequestMetadata).toHaveBeenCalledWith(
 *   expect.any(Object),
 *   expect.any(String),
 *   expect.objectContaining({
 *     userId: 1,
 *     tokensReserved: 100,
 *   })
 * );
 * ```
 */
export const createTokenUsageServiceMock = () => ({
  mockStoreRequestMetadata: vi.fn(),
  mockReconcileTokenUsageFromCallback: vi.fn(),
});
