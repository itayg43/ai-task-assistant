import { Express } from "express";
import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROCESS_EXIT_CODE } from "../../constants";
import { Mocked, ServicesCallbacks } from "../../types";
import { registerProcessEventHandlers } from "../process-event/register-process-event-handlers";
import { initializeServer } from "./server";

vi.mock("../process-event/register-process-event-handlers", () => ({
  registerProcessEventHandlers: vi.fn(),
}));

describe("server", () => {
  describe("initializeServer", () => {
    const mockServiceName = "test-service";
    const mockServicePort = 3000;

    let mockedRegisterProcessEventHandlers: Mocked<
      typeof registerProcessEventHandlers
    >;

    let mockApp: Express;
    let mockServer: Partial<http.Server>;

    let mockProcessExit: ReturnType<typeof vi.fn>;
    let originalProcessExit: typeof process.exit;

    let mockCallbacks: ServicesCallbacks;

    beforeEach(() => {
      mockedRegisterProcessEventHandlers = vi.mocked(
        registerProcessEventHandlers
      );

      mockApp = {} as Express;
      mockServer = {
        listen: vi.fn((_port, callback) => {
          if (callback) callback();

          return mockServer as http.Server;
        }),
        once: vi.fn(),
        close: vi.fn((cb) => cb()),
      };

      mockProcessExit = vi.fn();
      originalProcessExit = process.exit;
      process.exit = mockProcessExit as any;

      mockCallbacks = {
        startCallback: vi.fn().mockResolvedValue(undefined),
        cleanupCallbacks: {
          afterSuccess: vi.fn().mockResolvedValue(undefined),
          afterFailure: vi.fn().mockResolvedValue(undefined),
        },
      };

      vi.spyOn(http, "createServer").mockReturnValue(mockServer as http.Server);
    });

    afterEach(() => {
      vi.clearAllMocks();

      process.exit = originalProcessExit;
    });

    it.each([
      {
        description: "without callbacks",
        shouldCallStartCallback: false,
      },
      {
        description: "with callbacks",
        shouldCallStartCallback: true,
      },
    ])(
      "should initialize server successfully $description",
      async ({ shouldCallStartCallback }) => {
        const testCallbacks = shouldCallStartCallback
          ? mockCallbacks
          : undefined;

        await initializeServer(
          mockServiceName,
          mockServicePort,
          mockApp,
          testCallbacks
        );

        expect(http.createServer).toHaveBeenCalledWith(mockApp);
        expect(mockedRegisterProcessEventHandlers).toHaveBeenCalledWith(
          mockServer,
          process.exit,
          testCallbacks?.cleanupCallbacks
        );

        if (shouldCallStartCallback && testCallbacks) {
          expect(testCallbacks.startCallback).toHaveBeenCalled();
        }

        expect(mockServer.listen).toHaveBeenCalled();
        expect(mockProcessExit).not.toHaveBeenCalled();
      }
    );

    it("should call afterFailure and exit if startCallback fails", async () => {
      const startError = new Error("Failed to connect to database");
      mockCallbacks = {
        ...mockCallbacks,
        startCallback: vi.fn().mockRejectedValue(startError),
      };

      await initializeServer(
        mockServiceName,
        mockServicePort,
        mockApp,
        mockCallbacks
      );

      expect(mockCallbacks.startCallback).toHaveBeenCalled();
      expect(mockCallbacks.cleanupCallbacks.afterFailure).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(PROCESS_EXIT_CODE.ERROR);
      expect(mockServer.listen).not.toHaveBeenCalled();
    });

    it.each([
      {
        description: "without callbacks",
        shouldCallAfterFailure: false,
      },
      {
        description: "with callbacks",
        shouldCallAfterFailure: true,
      },
    ])(
      "should exit if startServer fails $description",
      async ({ shouldCallAfterFailure }) => {
        const listenError = new Error("Port already in use");
        let errorHandler: ((error: Error) => void) | undefined;

        mockServer.listen = vi.fn((_port, _callback) => {
          return mockServer as http.Server;
        });

        mockServer.once = vi.fn((event, handler) => {
          if (event === "error") {
            errorHandler = handler as (error: Error) => void;
          }

          return mockServer as http.Server;
        });

        const testCallbacks = shouldCallAfterFailure
          ? mockCallbacks
          : undefined;

        initializeServer(
          mockServiceName,
          mockServicePort,
          mockApp,
          testCallbacks
        );

        await new Promise((resolve) => setTimeout(resolve, 5));

        if (errorHandler) {
          errorHandler(listenError);
        }

        await new Promise((resolve) => setTimeout(resolve, 5));

        if (shouldCallAfterFailure && testCallbacks) {
          expect(
            testCallbacks.cleanupCallbacks.afterFailure
          ).toHaveBeenCalled();
        }

        expect(mockProcessExit).toHaveBeenCalledWith(PROCESS_EXIT_CODE.ERROR);
      }
    );

    it("should still exit if afterFailure throws an error", async () => {
      const startError = new Error("Failed to connect");
      const cleanupError = new Error("Cleanup failed");

      mockCallbacks = {
        ...mockCallbacks,
        startCallback: vi.fn().mockRejectedValue(startError),
        cleanupCallbacks: {
          ...mockCallbacks.cleanupCallbacks,
          afterFailure: vi.fn().mockRejectedValue(cleanupError),
        },
      };

      await initializeServer(
        mockServiceName,
        mockServicePort,
        mockApp,
        mockCallbacks
      );

      expect(mockCallbacks.cleanupCallbacks.afterFailure).toHaveBeenCalled();
      // Process should still exit even if afterFailure throws
      expect(mockProcessExit).toHaveBeenCalledWith(PROCESS_EXIT_CODE.ERROR);
    });
  });
});
