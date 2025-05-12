import { describe, it, expect, vi, beforeEach } from "vitest";
import signalHandler from "./signal-handler";

describe("signalHandler", () => {
  const mockLog = vi.spyOn(console, "log");
  const mockLogError = vi.spyOn(console, "error");
  const mockExit = vi
    .spyOn(process, "exit")
    .mockImplementation(() => void 0 as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should log message and exit with correct code", () => {
    const mockCode = 0;
    const mockMessage = "Gracefully shutting down...";

    const handler = signalHandler(mockCode, mockMessage);

    handler();

    expect(mockLog).toHaveBeenCalledWith(mockMessage);
    expect(mockLogError).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(mockCode);
  });

  it("should log error and exit with correct code", () => {
    const mockCode = 1;
    const mockError = new Error("Unknown error");

    const handler = signalHandler(mockCode);

    handler(mockError);

    expect(mockLog).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(mockError);
    expect(mockExit).toHaveBeenCalledWith(mockCode);
  });
});
