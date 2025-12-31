import { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenUsageErrorHandler } from "@middlewares/token-usage-error-handler";
import { mockRequestId, mockTokenUsage } from "@mocks/tasks-mocks";
import { Mocked } from "@shared/types";

const { mockOpenaiUpdateTokenUsage } = vi.hoisted(() => ({
  mockOpenaiUpdateTokenUsage: vi.fn(),
}));

vi.mock("@middlewares/token-usage-rate-limiter", () => ({
  openaiUpdateTokenUsage: (...args: unknown[]) =>
    mockOpenaiUpdateTokenUsage(...args),
}));

describe("tokenUsageErrorHandler", () => {
  let mockedOpenaiUpdateTokenUsage: Mocked<typeof mockOpenaiUpdateTokenUsage>;

  let mockError: Error;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: ReturnType<typeof vi.fn>;

  const executeMiddleware = (error: unknown) => {
    tokenUsageErrorHandler(error, req as Request, res as Response, next);
  };

  beforeEach(() => {
    mockedOpenaiUpdateTokenUsage = vi.mocked(mockOpenaiUpdateTokenUsage);

    mockError = new Error("Error");

    req = {};
    res = {
      locals: {
        requestId: mockRequestId,
        tokenUsage: mockTokenUsage,
      },
    };
    next = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should release reservation and propagate errors", () => {
    executeMiddleware(mockError);

    expect(res.locals?.tokenUsage?.actualTokens).toBe(0);
    expect(mockedOpenaiUpdateTokenUsage).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(mockError);
  });

  it.each([
    {
      description: "no reservation exists",
      setResLocals: () => {
        res.locals = {
          requestId: mockRequestId,
        };
      },
    },
    {
      description: "token usage is already reconciled",
      setResLocals: () => {
        res.locals = {
          requestId: mockRequestId,
          tokenUsage: {
            ...mockTokenUsage,
            actualTokens: 150, // Already reconciled
          },
        };
      },
    },
  ])("should skip update when $description", ({ setResLocals }) => {
    setResLocals();

    executeMiddleware(mockError);

    expect(mockedOpenaiUpdateTokenUsage).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(mockError);
  });
});
