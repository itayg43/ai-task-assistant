import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createManySubtasks } from "@repositories/subtasks-repository";
import { PrismaClient } from "@shared/clients/prisma";

describe("subtasksRepository", () => {
  let mockPrismaClient: {
    subtask: {
      createMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrismaClient = {
      subtask: {
        createMany: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createManySubtasks", () => {
    it("should create multiple subtasks with correct order and userId", async () => {
      const taskId = 1;
      const userId = 1;
      const subtasks = [
        "Gather Data For Report",
        "Write Q2 Report",
        "Review Report",
        "Submit Q2 Report",
      ];

      const mockResult = {
        count: subtasks.length,
      };

      mockPrismaClient.subtask.createMany.mockResolvedValue(mockResult);

      const result = await createManySubtasks(
        mockPrismaClient as unknown as PrismaClient,
        taskId,
        userId,
        subtasks
      );

      expect(mockPrismaClient.subtask.createMany).toHaveBeenCalledWith({
        data: [
          { taskId, userId, title: "Gather Data For Report", order: 0 },
          { taskId, userId, title: "Write Q2 Report", order: 1 },
          { taskId, userId, title: "Review Report", order: 2 },
          { taskId, userId, title: "Submit Q2 Report", order: 3 },
        ],
      });
      expect(result).toEqual(mockResult);
    });

    it("should handle empty subtasks array", async () => {
      const taskId = 1;
      const userId = 1;
      const subtasks: string[] = [];

      const mockResult = {
        count: 0,
      };

      mockPrismaClient.subtask.createMany.mockResolvedValue(mockResult);

      const result = await createManySubtasks(
        mockPrismaClient as unknown as PrismaClient,
        taskId,
        userId,
        subtasks
      );

      expect(mockPrismaClient.subtask.createMany).toHaveBeenCalledWith({
        data: [],
      });
      expect(result).toEqual(mockResult);
    });

    it("should handle single subtask", async () => {
      const taskId = 1;
      const userId = 1;
      const subtasks = ["Buy groceries"];

      const mockResult = {
        count: 1,
      };

      mockPrismaClient.subtask.createMany.mockResolvedValue(mockResult);

      const result = await createManySubtasks(
        mockPrismaClient as unknown as PrismaClient,
        taskId,
        userId,
        subtasks
      );

      expect(mockPrismaClient.subtask.createMany).toHaveBeenCalledWith({
        data: [{ taskId, userId, title: "Buy groceries", order: 0 }],
      });
      expect(result).toEqual(mockResult);
    });
  });
});
