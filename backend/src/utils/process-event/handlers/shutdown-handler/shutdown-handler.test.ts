import http from "http";
import { describe, it, vi, expect, beforeEach, afterEach } from "vitest";

import { EXIT_CODE } from "@constants";
import { shutdownHandler } from "./shutdown-handler";
import { closeRedisClient, destroyRedisClient } from "@clients";

vi.mock("@clients", () => ({
  closeRedisClient: vi.fn().mockResolvedValue(undefined),
  destroyRedisClient: vi.fn(),
}));

describe("shutdownHandler", () => {
  let mockServer: Partial<http.Server>;
  let mockExit: (code: number) => never;
  let shutdownView: Uint8Array;

  beforeEach(() => {
    mockServer = {
      close: vi.fn((cb) => cb()),
    };

    mockExit = vi.fn() as unknown as (code: number) => never;

    // create shutdown view for each test
    const buffer = new SharedArrayBuffer(1);
    shutdownView = new Uint8Array(buffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should exit with code 0 on normal shutdown", async () => {
    await shutdownHandler(
      mockServer as http.Server,
      "SIGTERM",
      undefined,
      shutdownView,
      mockExit
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(closeRedisClient).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODE.REGULAR);
  });

  it("should exit with code 1 on shutdown with error", async () => {
    const mockError = new Error("Test error");

    await shutdownHandler(
      mockServer as http.Server,
      "uncaughtException",
      mockError,
      shutdownView,
      mockExit
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(closeRedisClient).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODE.ERROR);
  });

  it("should exit with code 1 if server.close errors", async () => {
    const mockCloseError = new Error("Close error");
    mockServer.close = vi.fn((cb) => {
      cb(mockCloseError);
    }) as any;

    await shutdownHandler(
      mockServer as http.Server,
      "SIGTERM",
      undefined,
      shutdownView,
      mockExit
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(destroyRedisClient).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODE.ERROR);
  });

  it("should not call server.close more than once if already shutting down", async () => {
    // first call should trigger shutdown
    await shutdownHandler(
      mockServer as http.Server,
      "SIGTERM",
      undefined,
      shutdownView,
      mockExit
    );

    // second call should do nothing
    await shutdownHandler(
      mockServer as http.Server,
      "SIGINT",
      undefined,
      shutdownView,
      mockExit
    );

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(closeRedisClient).toHaveBeenCalledTimes(1);
    expect(mockExit).toHaveBeenCalledTimes(1);
  });
});
