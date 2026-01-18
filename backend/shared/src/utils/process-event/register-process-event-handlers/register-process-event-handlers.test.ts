import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Mocked,
  ProcessExitCallback,
  ServicesCleanupCallbacks,
} from "../../../types";
import { shutdownHandler } from "../handlers/shutdown-handler";
import { registerProcessEventHandlers } from "./register-process-event-handlers";

vi.mock("../handlers/shutdown-handler");
vi.mock("../../server", () => ({
  performFailureCleanup: vi.fn(),
}));

describe("registerProcessEventHandlers", () => {
  let mockedShutdownHandler: Mocked<typeof shutdownHandler>;

  let mockServer: Partial<http.Server>;

  let mockProcessExitCallback: ProcessExitCallback;

  let mockCleanupCallbacks: ServicesCleanupCallbacks;

  let processOnSpy: any;

  const events = [
    {
      name: "SIGINT",
      errorOrReason: undefined,
      expectedHandler: "shutdownHandler",
    },
    {
      name: "SIGTERM",
      errorOrReason: undefined,
      expectedHandler: "shutdownHandler",
    },
    {
      name: "uncaughtException",
      errorOrReason: new Error("Test uncaught exception"),
      expectedHandler: "shutdownHandler",
    },
    {
      name: "unhandledRejection",
      errorOrReason: "Test unhandled rejection",
      expectedHandler: "shutdownHandler",
    },
  ] as const;

  beforeEach(() => {
    mockedShutdownHandler = vi.mocked(shutdownHandler);

    mockServer = {
      close: vi.fn(),
    };

    mockProcessExitCallback = vi.fn() as unknown as ProcessExitCallback;

    mockCleanupCallbacks = {
      afterSuccess: vi.fn().mockResolvedValue(undefined),
      afterFailure: vi.fn().mockResolvedValue(undefined),
    };

    processOnSpy = vi.spyOn(process, "on");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(events)(
    "should register handler for $name event that calls $expectedHandler with server",
    ({ name, errorOrReason, expectedHandler }) => {
      registerProcessEventHandlers(
        mockProcessExitCallback,
        mockCleanupCallbacks,
        mockServer as http.Server
      );

      expect(processOnSpy).toHaveBeenCalledWith(name, expect.any(Function));

      const eventCall = processOnSpy.mock.calls.find(
        (call: any) => call[0] === name
      );
      const eventHandler = eventCall![1] as Function;

      eventHandler(errorOrReason);

      if (expectedHandler === "shutdownHandler") {
        expect(mockedShutdownHandler).toHaveBeenCalledWith(
          mockServer,
          name,
          errorOrReason,
          expect.any(Uint8Array),
          mockProcessExitCallback,
          mockCleanupCallbacks
        );
      }
    }
  );

  it.each(events)(
    "should register handler for $name event that calls $expectedHandler without server",
    ({ name, errorOrReason, expectedHandler }) => {
      registerProcessEventHandlers(
        mockProcessExitCallback,
        mockCleanupCallbacks
      );

      expect(processOnSpy).toHaveBeenCalledWith(name, expect.any(Function));

      const eventCall = processOnSpy.mock.calls.find(
        (call: any) => call[0] === name
      );
      const eventHandler = eventCall![1] as Function;

      eventHandler(errorOrReason);

      if (expectedHandler === "shutdownHandler") {
        expect(mockedShutdownHandler).toHaveBeenCalledWith(
          undefined,
          name,
          errorOrReason,
          expect.any(Uint8Array),
          mockProcessExitCallback,
          mockCleanupCallbacks
        );
      }
    }
  );

  it("should register handler without cleanup callbacks", () => {
    registerProcessEventHandlers(mockProcessExitCallback);

    expect(processOnSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));

    const eventCall = processOnSpy.mock.calls.find(
      (call: any) => call[0] === "SIGINT"
    );
    const eventHandler = eventCall![1] as Function;

    eventHandler(undefined);

    expect(mockedShutdownHandler).toHaveBeenCalledWith(
      undefined,
      "SIGINT",
      undefined,
      expect.any(Uint8Array),
      mockProcessExitCallback,
      undefined
    );
  });
});

