import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockNaturalLanguage,
  mockParsedTask,
  mockTask,
  mockUserId,
} from "@mocks/tasks-mocks";
import { createTask } from "@repositories/tasks-repository";
import { PrismaClient } from "@shared/clients/prisma";

describe("tasksRepository", () => {
  let mockPrismaClient: {
    task: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrismaClient = {
      task: {
        create: vi.fn(),
      },
    };
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

    it("should handle null dueDate correctly", async () => {
      const parsedTaskWithoutDueDate = {
        ...mockParsedTask,
        dueDate: null,
      };
      const mockTaskWithoutDueDate = {
        ...mockTask,
        dueDate: null,
      };

      mockPrismaClient.task.create.mockResolvedValue(mockTaskWithoutDueDate);

      const result = await createTask(
        mockPrismaClient as unknown as PrismaClient,
        mockUserId,
        mockNaturalLanguage,
        parsedTaskWithoutDueDate
      );

      expect(mockPrismaClient.task.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          naturalLanguage: mockNaturalLanguage,
          title: parsedTaskWithoutDueDate.title,
          dueDate: null,
          category: parsedTaskWithoutDueDate.category,
          priorityLevel: parsedTaskWithoutDueDate.priority.level,
          priorityScore: parsedTaskWithoutDueDate.priority.score,
          priorityReason: parsedTaskWithoutDueDate.priority.reason,
        },
      });
      expect(result).toEqual(mockTaskWithoutDueDate);
    });
  });
});
