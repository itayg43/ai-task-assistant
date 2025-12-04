import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CloseServerCleanupCallbacks,
  Mocked,
  ProcessExitCallback,
} from "../../../types";
import { shutdownHandler } from "../handlers/shutdown-handler";
import { registerProcessEventHandlers } from "./register-process-event-handlers";

vi.mock("../handlers/shutdown-handler");

describe("registerProcessEventHandlers", () => {
  let mockedShutdownHandler: Mocked<typeof shutdownHandler>;

  let mockServer: Partial<http.Server>;
  let mockProcessExitCallback: ProcessExitCallback;
  let mockCloseServerCleanupCallbacks: CloseServerCleanupCallbacks;

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
    mockCloseServerCleanupCallbacks = {
      afterSuccess: vi.fn().mockResolvedValue(undefined),
      afterFailure: vi.fn().mockResolvedValue(undefined),
    };

    processOnSpy = vi.spyOn(process, "on");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(events)(
    "should register handler for $name event that calls $expectedHandler",
    ({ name, errorOrReason, expectedHandler }) => {
      registerProcessEventHandlers(
        mockServer as http.Server,
        mockProcessExitCallback,
        mockCloseServerCleanupCallbacks
      );

      // verify that process.on was called with the correct event and a function
      expect(processOnSpy).toHaveBeenCalledWith(name, expect.any(Function));

      // get the handler for this event
      const eventCall = processOnSpy.mock.calls.find(
        (call: any) => call[0] === name
      );
      const eventHandler = eventCall![1] as Function;

      // trigger the handler
      eventHandler(errorOrReason);

      // verify the correct handler was called based on the expectedHandler
      if (expectedHandler === "shutdownHandler") {
        expect(mockedShutdownHandler).toHaveBeenCalledWith(
          mockServer,
          name,
          errorOrReason,
          expect.any(Uint8Array),
          mockProcessExitCallback,
          mockCloseServerCleanupCallbacks
        );
      }
    }
  );
});
