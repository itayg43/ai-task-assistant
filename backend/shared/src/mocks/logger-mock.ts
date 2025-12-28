import { vi } from "vitest";

/**
 * Creates a mock logger with all common logger methods.
 * Use this factory to create consistent logger mocks across test files.
 *
 * @example
 * ```ts
 * const { mockLogger, mockLoggerDebug, mockLoggerError } = createLoggerMock();
 *
 * vi.mock("@shared/config/create-logger", () => ({
 *   createLogger: vi.fn(() => mockLogger),
 * }));
 *
 * // In tests
 * expect(mockLoggerDebug).toHaveBeenCalledWith("message", { data: "value" });
 * ```
 */
export const createLoggerMock = () => {
  const mockLoggerDebug = vi.fn();
  const mockLoggerInfo = vi.fn();
  const mockLoggerWarn = vi.fn();
  const mockLoggerError = vi.fn();

  const mockLogger = {
    debug: mockLoggerDebug,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  };

  return {
    mockLogger,
    mockLoggerDebug,
    mockLoggerInfo,
    mockLoggerWarn,
    mockLoggerError,
  };
};
