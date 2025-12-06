import { vi } from "vitest";

export type MockPrismaClient = {
  task: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  subtask: {
    createMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

export const createMockPrismaClient = (): MockPrismaClient => ({
  task: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  subtask: {
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
});
