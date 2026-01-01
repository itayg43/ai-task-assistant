import { vi } from "vitest";

export const mockPublishJob = vi.fn();
export const mockCreateConsumer = vi.fn();
export const mockPublishToDLQ = vi.fn();

export const resetRabbitMQMocks = () => {
  mockPublishJob.mockReset();
  mockCreateConsumer.mockReset();
  mockPublishToDLQ.mockReset();
};
