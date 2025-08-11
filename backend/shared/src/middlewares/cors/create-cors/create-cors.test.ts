import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "../../../errors";
import { createCors } from "./create-cors";

describe("createCors", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const executeMiddleware = () => {
    const allowedOrigins = ["http://localhost:3001", "http://tasks:3001"];
    const middleware = createCors(allowedOrigins);
    middleware(mockReq as Request, mockRes as Response, mockNext);
  };

  beforeEach(() => {
    mockReq = {
      path: "/test",
      method: "GET",
      headers: {} as any,
    } as any;
    mockRes = {} as any;
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("no origin requests", () => {
    it("should allow health endpoint requests", () => {
      mockReq = {
        ...mockReq,
        path: "/health/healthz",
        headers: {
          origin: undefined,
        },
      };

      executeMiddleware();

      expect(mockNext).toHaveBeenCalled();
    });

    it("should block non-health endpoint requests", () => {
      mockReq = {
        ...mockReq,
        path: "/api/v1/ai/capabilities/parse-task",
        headers: {
          origin: undefined,
        },
      };

      executeMiddleware();

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe("with origin requests", () => {
    it("should allow requests from allowed origins", () => {
      mockReq = {
        ...mockReq,
        path: "/api/v1/ai/capabilities/parse-task",
        headers: {
          origin: "http://localhost:3001",
        },
      };

      executeMiddleware();

      expect(mockNext).toHaveBeenCalled();
    });

    it("should block requests from unauthorized origins", () => {
      mockReq = {
        ...mockReq,
        path: "/api/v1/ai/capabilities/parse-task",
        headers: {
          origin: "https://evil.com",
        },
      };

      executeMiddleware();

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });
});
