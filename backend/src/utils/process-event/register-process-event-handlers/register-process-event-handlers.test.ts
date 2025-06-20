import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import shutdownHandler from "../handlers/shutdown-handler/shutdown-handler";
import registerProcessEventHandlers from "./register-process-event-handlers";

vi.mock("../handlers/shutdown-handler/shutdown-handler", () => ({
  default: vi.fn(),
}));

describe("registerProcessEventHandlers", () => {
  let mockServer: Partial<http.Server>;
  let processOnSpy: any;
  let mockShutdownHandler: ReturnType<typeof vi.mocked<typeof shutdownHandler>>;

  const events: {
    name: string;
    errorOrReason: undefined | Error | string;
    expectedHandler: string;
  }[] = [
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
  ];

  beforeEach(() => {
    mockServer = {
      close: vi.fn(),
    };

    processOnSpy = vi.spyOn(process, "on");

    mockShutdownHandler = vi.mocked(shutdownHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(events)(
    "should register handler for $name event that calls $expectedHandler",
    ({ name, errorOrReason, expectedHandler }) => {
      registerProcessEventHandlers(mockServer as http.Server);

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
          expect.objectContaining({
            isShuttingDown: false,
          })
        );
      }
    }
  );
});
