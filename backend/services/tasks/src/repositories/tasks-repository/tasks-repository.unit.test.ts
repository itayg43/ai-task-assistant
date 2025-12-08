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
import {
  createTask,
  findTaskById,
  findTasks,
  FindTasksOptions,
} from "@repositories/tasks-repository";
import { PrismaClient } from "@shared/clients/prisma";

describe("tasksRepository (unit)", () => {
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
        mockTask.id,
        mockUserId
      );

      expect(mockPrismaClient.task.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockTask.id,
          userId: mockUserId,
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
        999,
        mockUserId
      );

      expect(mockPrismaClient.task.findUnique).toHaveBeenCalledWith({
        where: {
          id: 999,
          userId: mockUserId,
        },
        include: {
          subtasks: true,
        },
      });
      expect(result).toBeNull();
    });
  });

  describe("findTasks", () => {
    const mockTasks = [mockTaskWithSubtasks];
    const mockTotalCount = 1;

    const executeFindTasks = async (options: FindTasksOptions) => {
      return await findTasks(
        mockPrismaClient as unknown as PrismaClient,
        mockUserId,
        options
      );
    };

    beforeEach(() => {
      mockPrismaClient.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaClient.task.count.mockResolvedValue(mockTotalCount);
    });

    it("should find tasks with pagination, sorting, and no filters", async () => {
      const result = await executeFindTasks({
        skip: 0,
        take: 10,
        orderBy: "createdAt",
        orderDirection: "desc",
      });

      expect(mockPrismaClient.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: 0,
        take: 10,
        include: {
          subtasks: true,
        },
      });
      expect(mockPrismaClient.task.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
        },
      });
      expect(result).toEqual({
        tasks: mockTasks,
        totalCount: mockTotalCount,
        hasMore: false,
      });
    });

    it("should correctly apply category and priorityLevel filters", async () => {
      await executeFindTasks({
        skip: 0,
        take: 10,
        orderBy: "priorityScore",
        orderDirection: "asc",
        where: {
          category: "work",
          priorityLevel: "high",
        },
      });

      expect(mockPrismaClient.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          category: "work",
          priorityLevel: "high",
        },
        orderBy: {
          priorityScore: "asc",
        },
        skip: 0,
        take: 10,
        include: {
          subtasks: true,
        },
      });
    });

    it.each([
      {
        description: "more results exist",
        totalCount: 15,
        hasMore: true,
      },
      {
        description: "no more results exist",
        totalCount: 10,
        hasMore: false,
      },
    ])(
      "should calculate hasMore correctly when $description",
      async ({ totalCount, hasMore }) => {
        mockPrismaClient.task.count.mockResolvedValue(totalCount);

        const result = await executeFindTasks({
          skip: 0,
          take: 10,
          orderBy: "createdAt",
          orderDirection: "desc",
        });

        expect(result.hasMore).toBe(hasMore);
      }
    );
  });
});
