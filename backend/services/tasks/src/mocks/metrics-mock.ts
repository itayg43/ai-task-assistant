import { vi } from "vitest";

export const createTasksMetricsMock = () => ({
  mockRecordTasksApiSuccess: vi.fn(),
  mockRecordTasksApiFailure: vi.fn(),
  mockRecordVagueInput: vi.fn(),
  mockRecordPromptInjection: vi.fn(),
});
