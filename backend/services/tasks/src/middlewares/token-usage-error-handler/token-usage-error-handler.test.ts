import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenUsageErrorHandler } from "@middlewares/token-usage-error-handler";
import { mockRequestId } from "@mocks/tasks-mocks";
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

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const executeMiddleware = (error: unknown) => {
    tokenUsageErrorHandler(error, req as Request, res as Response, next);
  };

  beforeEach(() => {
    mockedOpenaiUpdateTokenUsage = vi.mocked(mockOpenaiUpdateTokenUsage);

    req = {} as Request;

    res = {
      locals: {
        tokenUsage: {
          tokensReserved: 100,
          windowStartTimestamp: 123,
        },
      },
    } as Partial<Response>;

    next = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should release reservation and propagate non-vague errors", () => {
    const unexpectedError = new Error("unexpected");

    executeMiddleware(unexpectedError);

    expect(res.locals?.tokenUsage?.actualTokens).toBe(0);
    expect(mockedOpenaiUpdateTokenUsage).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(unexpectedError);
  });

  it("should skip update when no reservation exists", () => {
    res.locals = {
      requestId: mockRequestId,
    }; // no tokenUsage

    const unexpectedError = new Error("unexpected");

    executeMiddleware(unexpectedError);

    expect(mockedOpenaiUpdateTokenUsage).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(unexpectedError);
  });
});
