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
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let shutdownView: Uint8Array;

  beforeEach(() => {
    mockServer = {
      close: vi.fn((cb) => cb()),
    };

    exitSpy = vi.spyOn(process, "exit") as never;

    // create shutdown view for each test
    const buffer = new SharedArrayBuffer(1);
    shutdownView = new Uint8Array(buffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should exit with code 0 on normal shutdown", async () => {
    await new Promise((resolve) => {
      exitSpy.mockImplementation((code) => {
        expect(code).toBe(EXIT_CODE.REGULAR);
        resolve(undefined);
      });

      shutdownHandler(
        mockServer as http.Server,
        "SIGTERM",
        undefined,
        shutdownView
      );
    });

    expect(mockServer.close).toHaveBeenCalled();
    expect(closeRedisClient).toHaveBeenCalled();
  });

  it("should exit with code 1 on shutdown with error", async () => {
    const mockError = new Error("Test error");

    await new Promise((resolve) => {
      exitSpy.mockImplementation((code) => {
        expect(code).toBe(EXIT_CODE.ERROR);
        resolve(undefined);
      });

      shutdownHandler(
        mockServer as http.Server,
        "SIGTERM",
        mockError,
        shutdownView
      );
    });

    expect(mockServer.close).toHaveBeenCalled();
    expect(closeRedisClient).toHaveBeenCalled();
  });

  it("should exit with code 1 if server.close errors", async () => {
    const mockCloseError = new Error("Close error");
    mockServer.close = vi.fn((cb) => {
      cb(mockCloseError);
    }) as any;

    await new Promise((resolve) => {
      exitSpy.mockImplementation((code) => {
        expect(code).toBe(EXIT_CODE.ERROR);
        resolve(undefined);
      });

      shutdownHandler(
        mockServer as http.Server,
        "SIGTERM",
        undefined,
        shutdownView
      );
    });

    expect(mockServer.close).toHaveBeenCalled();
    expect(destroyRedisClient).toHaveBeenCalled();
  });

  it("should not call server.close more than once if already shutting down", async () => {
    await new Promise((resolve) => {
      exitSpy.mockImplementation((code) => {
        expect(code).toBe(EXIT_CODE.REGULAR);
        resolve(undefined);
      });

      // first call should trigger shutdown
      shutdownHandler(
        mockServer as http.Server,
        "SIGTERM",
        undefined,
        shutdownView
      );

      // second call should do nothing
      shutdownHandler(
        mockServer as http.Server,
        "SIGINT",
        undefined,
        shutdownView
      );
    });

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(closeRedisClient).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
  });
});
