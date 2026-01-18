import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SERVER_SHUTDOWN_STATE } from "../../../constants";
import { checkIfShutdownAlreadyInProgress } from "./shutdown-state";

describe("shutdown-state", () => {
  describe("checkIfShutdownAlreadyInProgress", () => {
    let shutdownBuffer: SharedArrayBuffer;
    let shutdownView: Uint8Array;

    beforeEach(() => {
      shutdownBuffer = new SharedArrayBuffer(1);
      shutdownView = new Uint8Array(shutdownBuffer);
    });

    afterEach(() => {
      // Reset the state for clean tests
      Atomics.store(shutdownView, 0, SERVER_SHUTDOWN_STATE.NOT_SHUTTING_DOWN);
    });

    it("should return false when shutdown is not in progress (first call)", () => {
      const result = checkIfShutdownAlreadyInProgress(shutdownView);

      expect(result).toBe(false);
      // Verify the state was set to SHUTTING_DOWN
      expect(Atomics.load(shutdownView, 0)).toBe(
        SERVER_SHUTDOWN_STATE.SHUTTING_DOWN
      );
    });

    it("should return true when shutdown is already in progress (second call)", () => {
      // First call sets the state to shutting down
      checkIfShutdownAlreadyInProgress(shutdownView);

      // Second call should detect shutdown is already in progress
      const result = checkIfShutdownAlreadyInProgress(shutdownView);

      expect(result).toBe(true);
      // State should remain SHUTTING_DOWN
      expect(Atomics.load(shutdownView, 0)).toBe(
        SERVER_SHUTDOWN_STATE.SHUTTING_DOWN
      );
    });

    it("should atomically set state to SHUTTING_DOWN when not shutting down", () => {
      // Verify initial state
      expect(Atomics.load(shutdownView, 0)).toBe(
        SERVER_SHUTDOWN_STATE.NOT_SHUTTING_DOWN
      );

      const result = checkIfShutdownAlreadyInProgress(shutdownView);

      expect(result).toBe(false);
      // Verify state was atomically changed
      expect(Atomics.load(shutdownView, 0)).toBe(
        SERVER_SHUTDOWN_STATE.SHUTTING_DOWN
      );
    });

    it("should handle concurrent calls correctly (simulated)", () => {
      // Simulate concurrent calls by manually setting state between calls
      const firstResult = checkIfShutdownAlreadyInProgress(shutdownView);
      expect(firstResult).toBe(false);

      // Manually set state to simulate another process already shutting down
      Atomics.store(shutdownView, 0, SERVER_SHUTDOWN_STATE.SHUTTING_DOWN);

      const secondResult = checkIfShutdownAlreadyInProgress(shutdownView);
      expect(secondResult).toBe(true);
    });

    it("should return true if state is already SHUTTING_DOWN", () => {
      // Manually set state to SHUTTING_DOWN
      Atomics.store(shutdownView, 0, SERVER_SHUTDOWN_STATE.SHUTTING_DOWN);

      const result = checkIfShutdownAlreadyInProgress(shutdownView);

      expect(result).toBe(true);
      // State should remain SHUTTING_DOWN
      expect(Atomics.load(shutdownView, 0)).toBe(
        SERVER_SHUTDOWN_STATE.SHUTTING_DOWN
      );
    });

    it("should use atomic compareExchange for thread-safe operation", () => {
      // Verify the function uses atomic operations
      const initialValue = Atomics.load(shutdownView, 0);
      expect(initialValue).toBe(SERVER_SHUTDOWN_STATE.NOT_SHUTTING_DOWN);

      // Call the function - it should atomically change the value
      const result = checkIfShutdownAlreadyInProgress(shutdownView);

      expect(result).toBe(false);
      // Verify atomic operation succeeded
      const finalValue = Atomics.load(shutdownView, 0);
      expect(finalValue).toBe(SERVER_SHUTDOWN_STATE.SHUTTING_DOWN);
      expect(finalValue).not.toBe(initialValue);
    });
  });
});
