import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParsedTask } from "@mocks/tasks-mocks";
import { createTask, type Task } from "@repositories/tasks-repository";
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
      const userId = 1;
      const naturalLanguage = "Submit Q2 report by next Friday";
      const mockTask: Task = {
        id: 1,
        userId,
        naturalLanguage,
        title: mockParsedTask.title,
        dueDate: mockParsedTask.dueDate
          ? new Date(mockParsedTask.dueDate)
          : null,
        category: mockParsedTask.category,
        priorityLevel: mockParsedTask.priority.level,
        priorityScore: mockParsedTask.priority.score,
        priorityReason: mockParsedTask.priority.reason,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.task.create.mockResolvedValue(mockTask);

      const result = await createTask(
        mockPrismaClient as unknown as PrismaClient,
        userId,
        naturalLanguage,
        mockParsedTask
      );

      expect(mockPrismaClient.task.create).toHaveBeenCalledWith({
        data: {
          userId,
          naturalLanguage,
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
      const userId = 1;
      const naturalLanguage = "Submit Q2 report";
      const parsedTaskWithoutDueDate = {
        ...mockParsedTask,
        dueDate: null,
      };
      const mockTask: Task = {
        id: 1,
        userId,
        naturalLanguage,
        title: parsedTaskWithoutDueDate.title,
        dueDate: null,
        category: parsedTaskWithoutDueDate.category,
        priorityLevel: parsedTaskWithoutDueDate.priority.level,
        priorityScore: parsedTaskWithoutDueDate.priority.score,
        priorityReason: parsedTaskWithoutDueDate.priority.reason,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.task.create.mockResolvedValue(mockTask);

      const result = await createTask(
        mockPrismaClient as unknown as PrismaClient,
        userId,
        naturalLanguage,
        parsedTaskWithoutDueDate
      );

      expect(mockPrismaClient.task.create).toHaveBeenCalledWith({
        data: {
          userId,
          naturalLanguage,
          title: parsedTaskWithoutDueDate.title,
          dueDate: null,
          category: parsedTaskWithoutDueDate.category,
          priorityLevel: parsedTaskWithoutDueDate.priority.level,
          priorityScore: parsedTaskWithoutDueDate.priority.score,
          priorityReason: parsedTaskWithoutDueDate.priority.reason,
        },
      });
      expect(result).toEqual(mockTask);
    });
  });
});
