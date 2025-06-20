import http from "http";
import { describe, it, vi, expect, beforeEach, afterEach } from "vitest";

import { EXIT_CODE } from "../../../../constants/exit-code";
import shutdownHandler from "./shutdown-handler";

describe("shutdownHandler", () => {
  let mockServer: Partial<http.Server>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let shutdownView: Uint8Array;

  beforeEach(() => {
    mockServer = {
      close: vi.fn((cb) => cb()),
    };

    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((..._args: unknown[]) => {
        throw new Error("process.exit called");
      }) as never;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // create shutdown view for each test
    const buffer = new SharedArrayBuffer(1);
    shutdownView = new Uint8Array(buffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should log and exit with code 0 on normal shutdown", () => {
    try {
      shutdownHandler(
        mockServer as http.Server,
        "SIGTERM",
        undefined,
        shutdownView
      );
    } catch (e) {
      // expected due to process.exit mock
    }

    expect(logSpy).toHaveBeenCalledWith("Received SIGTERM. Shutting down...");
    expect(mockServer.close).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(EXIT_CODE.REGULAR);
  });

  it("should log and exit with code 1 on shutdown with error", () => {
    const mockError = new Error("Test error");
    try {
      shutdownHandler(
        mockServer as http.Server,
        "uncaughtException",
        mockError,
        shutdownView
      );
    } catch (e) {
      // expected due to process.exit mock
    }

    expect(errorSpy).toHaveBeenCalledWith(
      "Shutting down due to uncaughtException:",
      mockError
    );
    expect(mockServer.close).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(EXIT_CODE.ERROR);
  });

  it("should exit with code 1 if server.close errors", () => {
    const mockCloseError = new Error("Close error");
    mockServer.close = vi.fn((cb) => {
      cb(mockCloseError);
    }) as any;

    try {
      shutdownHandler(
        mockServer as http.Server,
        "SIGTERM",
        undefined,
        shutdownView
      );
    } catch (e) {
      // expected due to process.exit mock
    }

    expect(errorSpy).toHaveBeenCalledWith(
      "Error while closing the server:",
      mockCloseError
    );
    expect(exitSpy).toHaveBeenCalledWith(EXIT_CODE.ERROR);
    expect(logSpy).not.toHaveBeenCalledWith("HTTP server closed.");
  });

  it("should not call server.close more than once if already shutting down", () => {
    // first call should trigger shutdown
    try {
      shutdownHandler(
        mockServer as http.Server,
        "SIGTERM",
        undefined,
        shutdownView
      );
    } catch (e) {}
    // second call should do nothing
    shutdownHandler(
      mockServer as http.Server,
      "SIGINT",
      undefined,
      shutdownView
    );

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
  });
});
