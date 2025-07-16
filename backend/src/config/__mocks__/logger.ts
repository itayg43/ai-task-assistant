import { vi } from "vitest";

export const mockInfo = vi.fn();
export const mockError = vi.fn();
export const mockWarn = vi.fn();
export const createLogger = vi.fn(() => ({
  info: mockInfo,
  error: mockError,
  warn: mockWarn,
}));
