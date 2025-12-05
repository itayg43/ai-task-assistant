import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockPrismaClient,
  type MockPrismaClient,
} from "@mocks/prisma-mock";
import {
  mockNaturalLanguage,
  mockParsedTask,
  mockTask,
  mockTaskWithSubtasks,
  mockUserId,
} from "@mocks/tasks-mocks";
import { createTask, findTaskById } from "@repositories/tasks-repository";
import { PrismaClient } from "@shared/clients/prisma";

describe("tasksRepository", () => {
  let mockPrismaClient: MockPrismaClient;

  beforeEach(() => {
    mockPrismaClient = createMockPrismaClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    it("should create a task with correct data transformation", async () => {
      mockPrismaClient.task.create.mockResolvedValue(mockTask);

      const result = await createTask(
        mockPrismaClient as unknown as PrismaClient,
        mockUserId,
        mockNaturalLanguage,
        mockParsedTask
      );

      expect(mockPrismaClient.task.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          naturalLanguage: mockNaturalLanguage,
          title: mockParsedTask.title,
          dueDate: mockParsedTask.dueDate
            ? new Date(mockParsedTask.dueDate)
            : null,
          category: mockParsedTask.category,
          priorityLevel: mockParsedTask.priority.level,
          priorityScore: mockParsedTask.priority.score,
          priorityReason: mockParsedTask.priority.reason,
        },
      });
      expect(result).toEqual(mockTask);
    });
  });

  describe("findTaskById", () => {
    it("should find task with subtasks", async () => {
      mockPrismaClient.task.findUnique.mockResolvedValue(mockTaskWithSubtasks);

      const result = await findTaskById(
        mockPrismaClient as unknown as PrismaClient,
        mockTask.id
      );

      expect(mockPrismaClient.task.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockTask.id,
        },
        include: {
          subtasks: true,
        },
      });
      expect(result).toEqual(mockTaskWithSubtasks);
    });

    it("should return null when task not found", async () => {
      mockPrismaClient.task.findUnique.mockResolvedValue(null);

      const result = await findTaskById(
        mockPrismaClient as unknown as PrismaClient,
        999
      );

      expect(mockPrismaClient.task.findUnique).toHaveBeenCalledWith({
        where: {
          id: 999,
        },
        include: {
          subtasks: true,
        },
      });
      expect(result).toBeNull();
    });
  });
});
