import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shutdownHandler } from "../handlers";
import { registerProcessEventHandlers } from "./register-process-event-handlers";
import { ExitCallback } from "@types";

vi.mock("../handlers/shutdown-handler/shutdown-handler", () => ({
  shutdownHandler: vi.fn(),
}));

describe("registerProcessEventHandlers", () => {
  let mockServer: Partial<http.Server>;
  let processOnSpy: any;
  let mockShutdownHandler: ReturnType<typeof vi.mocked<typeof shutdownHandler>>;
  let mockExitCallback: ExitCallback;

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
    mockServer = {
      close: vi.fn(),
    };

    processOnSpy = vi.spyOn(process, "on");

    mockShutdownHandler = vi.mocked(shutdownHandler);
    mockExitCallback = vi.fn() as unknown as ExitCallback;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(events)(
    "should register handler for $name event that calls $expectedHandler",
    ({ name, errorOrReason, expectedHandler }) => {
      registerProcessEventHandlers(mockServer as http.Server, mockExitCallback);

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
        expect(mockShutdownHandler).toHaveBeenCalledWith(
          mockServer,
          name,
          errorOrReason,
          expect.any(Uint8Array),
          mockExitCallback
        );
      }
    }
  );
});
