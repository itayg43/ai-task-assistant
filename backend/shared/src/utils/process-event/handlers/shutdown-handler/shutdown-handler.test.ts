import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROCESS_EXIT_CODE } from "../../../../constants";
import {
  ProcessExitCallback,
  ServicesCleanupCallbacks,
} from "../../../../types";
import { shutdownHandler } from "./shutdown-handler";

describe("shutdownHandler", () => {
  let mockServer: Partial<http.Server>;

  let mockShutdownView: Uint8Array;

  let mockProcessExitCallback: ProcessExitCallback;

  let mockCleanupCallbacks: ServicesCleanupCallbacks;

  beforeEach(() => {
    mockServer = {
      close: vi.fn((cb) => cb()),
    };

    const buffer = new SharedArrayBuffer(1);
    mockShutdownView = new Uint8Array(buffer);

    mockProcessExitCallback = vi.fn() as unknown as ProcessExitCallback;

    mockCleanupCallbacks = {
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
      mockCleanupCallbacks
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockCleanupCallbacks.afterSuccess).toHaveBeenCalled();
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
      mockCleanupCallbacks
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockCleanupCallbacks.afterSuccess).toHaveBeenCalled();
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
      mockCleanupCallbacks
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockCleanupCallbacks.afterFailure).toHaveBeenCalled();
    expect(mockProcessExitCallback).toHaveBeenCalledWith(
      PROCESS_EXIT_CODE.ERROR
    );
  });

  it("should not call server.close more than once if already shutting down", async () => {
    await Promise.all([
      shutdownHandler(
        mockServer as http.Server,
        "SIGTERM",
        undefined,
        mockShutdownView,
        mockProcessExitCallback,
        mockCleanupCallbacks
      ),
      shutdownHandler(
        mockServer as http.Server,
        "SIGINT",
        undefined,
        mockShutdownView,
        mockProcessExitCallback,
        mockCleanupCallbacks
      ),
    ]);

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(mockCleanupCallbacks.afterSuccess).toHaveBeenCalledTimes(1);
    expect(mockProcessExitCallback).toHaveBeenCalledTimes(1);
  });

  it("should handle errors in afterFailure gracefully and still exit", async () => {
    const mockCloseError = new Error("Close error");
    mockServer.close = vi.fn((cb) => {
      cb(mockCloseError);
    }) as any;

    const mockCleanupError = new Error("Cleanup error");
    mockCleanupCallbacks.afterFailure = vi
      .fn()
      .mockRejectedValue(mockCleanupError);

    await shutdownHandler(
      mockServer as http.Server,
      "SIGTERM",
      undefined,
      mockShutdownView,
      mockProcessExitCallback,
      mockCleanupCallbacks
    );

    expect(mockServer.close).toHaveBeenCalled();
    expect(mockCleanupCallbacks.afterFailure).toHaveBeenCalled();
    expect(mockProcessExitCallback).toHaveBeenCalledWith(
      PROCESS_EXIT_CODE.ERROR
    );
  });
});
