import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROCESS_EXIT_CODE } from "../../../../constants";
import {
  CloseServerCleanupCallbacks,
  ProcessExitCallback,
} from "../../../../types";
import { shutdownHandler } from "./shutdown-handler";

describe("shutdownHandler", () => {
  let mockServer: Partial<http.Server>;
  let mockShutdownView: Uint8Array;
  let mockProcessExitCallback: ProcessExitCallback;
  let mockCloseServerCleanupCallbacks: CloseServerCleanupCallbacks;

  beforeEach(() => {
    mockServer = {
      close: vi.fn((cb) => cb()),
    };
    // create shutdown view for each test
    const buffer = new SharedArrayBuffer(1);
    mockShutdownView = new Uint8Array(buffer);
    mockProcessExitCallback = vi.fn() as unknown as ProcessExitCallback;
    mockCloseServerCleanupCallbacks = {
      afterSuccess: vi.fn().mockResolvedValue(undefined),
      afterFailure: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should exit with code 0 on normal shutdown", async () => {
    await shutdownHandler(
      mockServer as http.Server,
      "SIGTERM",
      undefined,
      mockShutdownView,
      mockProcessExitCallback,
      mockCloseServerCleanupCallbacks
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockCloseServerCleanupCallbacks.afterSuccess).toHaveBeenCalled();
    expect(mockProcessExitCallback).toHaveBeenCalledWith(
      PROCESS_EXIT_CODE.REGULAR
    );
  });

  it("should exit with code 1 on shutdown with error", async () => {
    const mockError = new Error("Test error");

    await shutdownHandler(
      mockServer as http.Server,
      "uncaughtException",
      mockError,
      mockShutdownView,
      mockProcessExitCallback,
      mockCloseServerCleanupCallbacks
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockCloseServerCleanupCallbacks.afterSuccess).toHaveBeenCalled();
    expect(mockProcessExitCallback).toHaveBeenCalledWith(
      PROCESS_EXIT_CODE.ERROR
    );
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
      mockShutdownView,
      mockProcessExitCallback,
      mockCloseServerCleanupCallbacks
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockCloseServerCleanupCallbacks.afterFailure).toHaveBeenCalled();
    expect(mockProcessExitCallback).toHaveBeenCalledWith(
      PROCESS_EXIT_CODE.ERROR
    );
  });

  it("should not call server.close more than once if already shutting down", async () => {
    // first call should trigger shutdown
    await shutdownHandler(
      mockServer as http.Server,
      "SIGTERM",
      undefined,
      mockShutdownView,
      mockProcessExitCallback,
      mockCloseServerCleanupCallbacks
    );

    // second call should do nothing
    await shutdownHandler(
      mockServer as http.Server,
      "SIGINT",
      undefined,
      mockShutdownView,
      mockProcessExitCallback,
      mockCloseServerCleanupCallbacks
    );

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(mockCloseServerCleanupCallbacks.afterSuccess).toHaveBeenCalledTimes(
      1
    );
    expect(mockProcessExitCallback).toHaveBeenCalledTimes(1);
  });
});
