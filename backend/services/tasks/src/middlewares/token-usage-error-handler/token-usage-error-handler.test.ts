import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenUsageErrorHandler } from "@middlewares/token-usage-error-handler";

const { mockOpenaiUpdateTokenUsage } = vi.hoisted(() => ({
  mockOpenaiUpdateTokenUsage: vi.fn(),
}));

vi.mock("@middlewares/token-usage-rate-limiter", () => ({
  openaiUpdateTokenUsage: (...args: unknown[]) =>
    mockOpenaiUpdateTokenUsage(...args),
}));

describe("tokenUsageErrorHandler", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const executeMiddleware = (error: unknown) => {
    tokenUsageErrorHandler(error, req as Request, res as Response, next);
  };

  beforeEach(() => {
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

  it("should release reservation and propagate non-vague errors", async () => {
    const unexpectedError = new Error("unexpected");

    executeMiddleware(unexpectedError);

    expect(res.locals?.tokenUsage?.actualTokens).toBe(0);
    expect(vi.mocked(mockOpenaiUpdateTokenUsage)).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(unexpectedError);
  });
});
