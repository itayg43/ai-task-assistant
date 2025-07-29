import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeRedisClient, destroyRedisClient } from "@clients/redis";
import { EXIT_CODE } from "@constants";
import { ExitCallback, Mocked } from "@types";
import { shutdownHandler } from "@utils/process-event/handlers/shutdown-handler";

vi.mock("@clients/redis");

describe("shutdownHandler", () => {
  let mockedCloseRedisClient: Mocked<typeof closeRedisClient>;
  let mockedDestroyRedisClient: Mocked<typeof destroyRedisClient>;

  let mockServer: Partial<http.Server>;
  let mockExitCallback: ExitCallback;
  let shutdownView: Uint8Array;

  beforeEach(() => {
    mockedCloseRedisClient = vi.mocked(closeRedisClient);
    mockedDestroyRedisClient = vi.mocked(destroyRedisClient);

    mockServer = {
      close: vi.fn((cb) => cb()),
    };

    mockExitCallback = vi.fn() as unknown as ExitCallback;

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
      mockExitCallback
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockedCloseRedisClient).toHaveBeenCalled();
    expect(mockExitCallback).toHaveBeenCalledWith(EXIT_CODE.REGULAR);
  });

  it("should exit with code 1 on shutdown with error", async () => {
    const mockError = new Error("Test error");

    await shutdownHandler(
      mockServer as http.Server,
      "uncaughtException",
      mockError,
      shutdownView,
      mockExitCallback
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockedCloseRedisClient).toHaveBeenCalled();
    expect(mockExitCallback).toHaveBeenCalledWith(EXIT_CODE.ERROR);
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
      mockExitCallback
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockedDestroyRedisClient).toHaveBeenCalled();
    expect(mockExitCallback).toHaveBeenCalledWith(EXIT_CODE.ERROR);
  });

  it("should not call server.close more than once if already shutting down", async () => {
    // first call should trigger shutdown
    await shutdownHandler(
      mockServer as http.Server,
      "SIGTERM",
      undefined,
      shutdownView,
      mockExitCallback
    );

    // second call should do nothing
    await shutdownHandler(
      mockServer as http.Server,
      "SIGINT",
      undefined,
      shutdownView,
      mockExitCallback
    );

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(mockedCloseRedisClient).toHaveBeenCalledTimes(1);
    expect(mockExitCallback).toHaveBeenCalledTimes(1);
  });
});
