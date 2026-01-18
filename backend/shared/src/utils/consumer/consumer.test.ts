import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROCESS_EXIT_CODE } from "../../constants";
import { Mocked, ServicesCallbacks } from "../../types";
import { registerProcessEventHandlers } from "../process-event/register-process-event-handlers";
import { performFailureCleanup } from "../server/server";
import { initializeConsumer } from "./consumer";

vi.mock("../process-event/register-process-event-handlers", () => ({
  registerProcessEventHandlers: vi.fn(),
}));

vi.mock("../server/server", () => ({
  performFailureCleanup: vi.fn(),
}));

describe("consumer", () => {
  describe("initializeConsumer", () => {
    const mockServiceName = "test-consumer";

    let mockedRegisterProcessEventHandlers: Mocked<
      typeof registerProcessEventHandlers
    >;

    let mockedPerformFailureCleanup: Mocked<typeof performFailureCleanup>;

    let mockProcessExit: ReturnType<typeof vi.fn>;
    let originalProcessExit: typeof process.exit;

    let mockCallbacks: ServicesCallbacks;

    beforeEach(() => {
      mockedRegisterProcessEventHandlers = vi.mocked(
        registerProcessEventHandlers
      );

      mockedPerformFailureCleanup = vi.mocked(performFailureCleanup);
      mockedPerformFailureCleanup.mockResolvedValue(undefined);

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
      "should initialize consumer successfully $description",
      async ({ shouldCallStartCallback }) => {
        const testCallbacks = shouldCallStartCallback
          ? mockCallbacks
          : undefined;

        await initializeConsumer(mockServiceName, testCallbacks);

        expect(mockedRegisterProcessEventHandlers).toHaveBeenCalledWith(
          process.exit,
          testCallbacks?.cleanupCallbacks
        );

        if (shouldCallStartCallback && testCallbacks) {
          expect(testCallbacks.startCallback).toHaveBeenCalled();
        }

        expect(mockProcessExit).not.toHaveBeenCalled();
      }
    );

    it("should call performFailureCleanup and exit if startCallback fails", async () => {
      const startError = new Error("Failed to connect to RabbitMQ");
      mockCallbacks = {
        ...mockCallbacks,
        startCallback: vi.fn().mockRejectedValue(startError),
      };

      await initializeConsumer(mockServiceName, mockCallbacks);

      expect(mockCallbacks.startCallback).toHaveBeenCalled();
      expect(mockedPerformFailureCleanup).toHaveBeenCalledWith(
        mockCallbacks.cleanupCallbacks.afterFailure
      );
      expect(mockProcessExit).toHaveBeenCalledWith(PROCESS_EXIT_CODE.ERROR);
    });

    it("should still exit if afterFailure callback throws an error", async () => {
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

      await initializeConsumer(mockServiceName, mockCallbacks);

      expect(mockedPerformFailureCleanup).toHaveBeenCalledWith(
        mockCallbacks.cleanupCallbacks.afterFailure
      );
      // performFailureCleanup handles errors gracefully, so process should still exit
      expect(mockProcessExit).toHaveBeenCalledWith(PROCESS_EXIT_CODE.ERROR);
    });
  });
});
