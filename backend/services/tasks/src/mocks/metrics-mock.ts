import { vi } from "vitest";

/**
 * Creates all tasks metrics mock functions.
 * Use this factory to ensure consistent mocking across integration tests.
 *
 * @example
 * ```typescript
 * const { mockRecordTasksApiSuccess, mockRecordTasksApiFailure } =
 *   vi.hoisted(() => createTasksMetricsMock());
 *
 * vi.mock("@metrics/tasks-metrics", () => ({
 *   recordTasksApiSuccess: mockRecordTasksApiSuccess,
 *   recordTasksApiFailure: mockRecordTasksApiFailure,
 *   recordVagueInput: mockRecordVagueInput,
 *   recordPromptInjection: mockRecordPromptInjection,
 * }));
 *
 * // In test: verify metrics were recorded
 * expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
 *   TASKS_OPERATION.CREATE_TASK,
 *   expect.any(Number),
 *   expect.any(String)
 * );
 * ```
 */
export const createTasksMetricsMock = () => ({
  mockRecordTasksApiSuccess: vi.fn(),
  mockRecordTasksApiFailure: vi.fn(),
  mockRecordVagueInput: vi.fn(),
  mockRecordPromptInjection: vi.fn(),
});
