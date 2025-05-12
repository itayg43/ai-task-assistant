import { describe, it, vi, beforeEach, expect } from "vitest";
import processHandlers from "./process-handlers";
import signalHandler from "../signal-handler/signal-handler";

vi.mock("../signal-handler/signal-handler", () => ({
  default: vi.fn(() => vi.fn()),
}));

describe("processHandlers", () => {
  const mockProcessOn = vi.spyOn(process, "on");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers handlers for SIGINT, SIGTERM, uncaughtException, and unhandledRejection", () => {
    processHandlers();

    expect(signalHandler).toHaveBeenCalledTimes(4);
    expect(mockProcessOn).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(mockProcessOn).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(mockProcessOn).toHaveBeenCalledWith(
      "uncaughtException",
      expect.any(Function)
    );
    expect(mockProcessOn).toHaveBeenCalledWith(
      "unhandledRejection",
      expect.any(Function)
    );
  });
});
