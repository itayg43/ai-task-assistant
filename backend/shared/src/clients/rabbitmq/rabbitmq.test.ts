import * as amqp from "amqplib";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { closeRabbitMQConnection, createRabbitMQConnection } from "./rabbitmq";

const { mockAmqpConnect, mockWithRetry } = vi.hoisted(() => ({
  mockAmqpConnect: vi.fn(),
  mockWithRetry: vi.fn(),
}));

vi.mock("amqplib", () => ({
  connect: mockAmqpConnect,
}));

vi.mock("../../utils/with-retry", () => ({
  withRetry: mockWithRetry,
}));

describe("rabbitmq", () => {
  const mockUrl = "amqp://user:password@localhost:5672";

  let mockConnection: amqp.ChannelModel;
  let mockOnError: (error: Error) => void;

  beforeEach(() => {
    mockOnError = vi.fn();
    mockConnection = {
      on: vi.fn((event: string, handler: (error: Error) => void) => {
        if (event === "error") {
          mockOnError = handler;
        }
      }),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as amqp.ChannelModel;
    mockAmqpConnect.mockResolvedValue(mockConnection);

    mockWithRetry.mockImplementation(async (fn) => {
      return await fn();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createRabbitMQConnection", () => {
    it("should create connection with retry logic", async () => {
      const result = await createRabbitMQConnection(mockUrl);

      expect(mockWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        {
          operation: "createRabbitMQConnection",
        }
      );
      expect(mockAmqpConnect).toHaveBeenCalledWith(mockUrl);
      expect(result).toBe(mockConnection);
    });

    it("should set up error event handler on connection", async () => {
      await createRabbitMQConnection(mockUrl);

      expect(mockConnection.on).toHaveBeenCalledWith(
        "error",
        expect.any(Function)
      );
    });

    it("should use withRetry for connection retry logic", async () => {
      const connectionError = new Error("Connection failed");

      mockAmqpConnect
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce(mockConnection);

      mockWithRetry.mockImplementation(async (fn) => {
        try {
          return await fn();
        } catch (error) {
          // Simulate retry
          return await fn();
        }
      });

      const result = await createRabbitMQConnection(mockUrl);

      expect(mockWithRetry).toHaveBeenCalled();
      expect(mockAmqpConnect).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockConnection);
    });

    it("should propagate connection errors through withRetry", async () => {
      const connectionError = new Error("Connection failed");

      mockAmqpConnect.mockRejectedValue(connectionError);
      mockWithRetry.mockImplementation(async (fn) => {
        return await fn();
      });

      await expect(createRabbitMQConnection(mockUrl)).rejects.toThrow(
        "Connection failed"
      );

      expect(mockWithRetry).toHaveBeenCalled();
      expect(mockAmqpConnect).toHaveBeenCalledWith(mockUrl);
    });
  });

  describe("closeRabbitMQConnection", () => {
    it("should close connection gracefully", async () => {
      (mockConnection.close as Mock).mockResolvedValue(undefined);

      await closeRabbitMQConnection(mockConnection);

      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });

    it("should throw error if close operation fails", async () => {
      const closeError = new Error("Failed to close connection");
      (mockConnection.close as Mock).mockRejectedValue(closeError);

      await expect(closeRabbitMQConnection(mockConnection)).rejects.toThrow(
        "Failed to close connection"
      );

      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });
  });
});
