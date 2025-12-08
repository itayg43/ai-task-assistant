import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  mockNaturalLanguage,
  mockParsedTask,
  mockUserId,
} from "@mocks/tasks-mocks";
import {
  createTask,
  findTaskById,
  findTasks,
} from "@repositories/tasks-repository";
import { GET_TASKS_ALLOWED_ORDER_DIRECTIONS } from "@constants";
import { createPrismaClient } from "@shared/clients/prisma";

describe("tasksRepository (integration)", () => {
  let prismaClient: ReturnType<typeof createPrismaClient>;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      throw new Error("Please define DATABASE_URL in .env.test");
    }

    prismaClient = createPrismaClient(dbUrl);
    await prismaClient.$connect();
  });

  afterEach(async () => {
    await prismaClient.subtask.deleteMany();
    await prismaClient.task.deleteMany();
  });

  afterAll(async () => {
    await prismaClient.$disconnect();
  });

  describe("createTask and findTaskById", () => {
    it("should create a task and find it with subtasks", async () => {
      const createdTask = await createTask(
        prismaClient,
        mockUserId,
        mockNaturalLanguage,
        mockParsedTask
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.id).toBeDefined();
      expect(createdTask.userId).toBe(mockUserId);
      expect(createdTask.title).toBe(mockParsedTask.title);
      expect(createdTask.category).toBe(mockParsedTask.category);
      expect(createdTask.priorityLevel).toBe(mockParsedTask.priority.level);
      expect(createdTask.priorityScore).toBe(mockParsedTask.priority.score);
      expect(createdTask.priorityReason).toBe(mockParsedTask.priority.reason);
      expect(createdTask.naturalLanguage).toBe(mockNaturalLanguage);

      const foundTask = await findTaskById(
        prismaClient,
        createdTask.id,
        mockUserId
      );

      expect(foundTask).toBeDefined();
      expect(foundTask?.id).toBe(createdTask.id);
      expect(foundTask?.userId).toBe(mockUserId);
      expect(foundTask?.subtasks).toBeDefined();
      expect(Array.isArray(foundTask?.subtasks)).toBe(true);
    });

    it("should return null when task does not exist", async () => {
      const result = await findTaskById(prismaClient, 99999, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe("findTasks", () => {
    const createTestTask = async (
      userId: number,
      title: string,
      category: string,
      priorityLevel: string,
      priorityScore: number,
      dueDate: Date | null = null
    ) => {
      return await createTask(
        prismaClient,
        userId,
        `Natural language for ${title}`,
        {
          title,
          dueDate: dueDate ? dueDate.toISOString() : null,
          category,
          priority: {
            level: priorityLevel,
            score: priorityScore,
            reason: `Reason for ${title}`,
          },
          subtasks: null,
        }
      );
    };

    it("should handle pagination with skip and take", async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestTask(mockUserId, `Task ${i}`, "work", "high", 8);
      }

      const page1 = await findTasks(prismaClient, mockUserId, {
        skip: 0,
        take: 2,
        orderBy: "createdAt",
        orderDirection: "desc",
      });

      expect(page1.tasks).toHaveLength(2);
      expect(page1.totalCount).toBe(5);
      expect(page1.hasMore).toBe(true);

      const page2 = await findTasks(prismaClient, mockUserId, {
        skip: 2,
        take: 2,
        orderBy: "createdAt",
        orderDirection: "desc",
      });

      expect(page2.tasks).toHaveLength(2);
      expect(page2.totalCount).toBe(5);
      expect(page2.hasMore).toBe(true);

      const page3 = await findTasks(prismaClient, mockUserId, {
        skip: 4,
        take: 2,
        orderBy: "createdAt",
        orderDirection: "desc",
      });

      expect(page3.tasks).toHaveLength(1);
      expect(page3.totalCount).toBe(5);
      expect(page3.hasMore).toBe(false);
    });

    it("should return paginated tasks with default options", async () => {
      await createTestTask(mockUserId, "Task 1", "work", "high", 8);
      await createTestTask(mockUserId, "Task 2", "personal", "medium", 5);

      const result = await findTasks(prismaClient, mockUserId, {
        skip: 0,
        take: 10,
        orderBy: "createdAt",
        orderDirection: "desc",
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by userId only", async () => {
      await createTestTask(mockUserId, "User 1 Task", "work", "high", 8);
      await createTestTask(mockUserId + 1, "User 2 Task", "work", "high", 8);

      const result = await findTasks(prismaClient, mockUserId, {
        skip: 0,
        take: 10,
        orderBy: "createdAt",
        orderDirection: "desc",
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.tasks[0].userId).toBe(mockUserId);
    });

    it("should filter by category", async () => {
      await createTestTask(mockUserId, "Work Task", "work", "high", 8);
      await createTestTask(
        mockUserId,
        "Personal Task",
        "personal",
        "medium",
        5
      );

      const result = await findTasks(prismaClient, mockUserId, {
        skip: 0,
        take: 10,
        orderBy: "createdAt",
        orderDirection: "desc",
        where: {
          category: "work",
        },
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.tasks[0].category).toBe("work");
    });

    it("should filter by priorityLevel", async () => {
      await createTestTask(mockUserId, "High Priority", "work", "high", 8);
      await createTestTask(mockUserId, "Low Priority", "work", "low", 2);

      const result = await findTasks(prismaClient, mockUserId, {
        skip: 0,
        take: 10,
        orderBy: "createdAt",
        orderDirection: "desc",
        where: {
          priorityLevel: "high",
        },
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.tasks[0].priorityLevel).toBe("high");
    });

    it("should apply multiple filters together", async () => {
      await createTestTask(mockUserId, "Match 1", "work", "high", 8);
      await createTestTask(mockUserId, "Match 2", "work", "high", 9);
      await createTestTask(mockUserId, "No Match 1", "personal", "high", 8);
      await createTestTask(mockUserId, "No Match 2", "work", "low", 3);

      const result = await findTasks(prismaClient, mockUserId, {
        skip: 0,
        take: 10,
        orderBy: "createdAt",
        orderDirection: "desc",
        where: {
          category: "work",
          priorityLevel: "high",
        },
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.tasks.every((t) => t.category === "work")).toBe(true);
      expect(result.tasks.every((t) => t.priorityLevel === "high")).toBe(true);
    });

    it.each(
      GET_TASKS_ALLOWED_ORDER_DIRECTIONS.map((orderDirection) => ({
        orderDirection,
        firstTaskIndex: orderDirection === "desc" ? 1 : 0,
        secondTaskIndex: orderDirection === "desc" ? 0 : 1,
      }))
    )(
      "should sort by createdAt $orderDirection",
      async ({ orderDirection, firstTaskIndex, secondTaskIndex }) => {
        const task1 = await createTestTask(
          mockUserId,
          "First Task",
          "work",
          "high",
          8
        );

        await new Promise((resolve) => setTimeout(resolve, 10));

        const task2 = await createTestTask(
          mockUserId,
          "Second Task",
          "work",
          "high",
          8
        );

        const tasks = [task1, task2];

        const result = await findTasks(prismaClient, mockUserId, {
          skip: 0,
          take: 10,
          orderBy: "createdAt",
          orderDirection,
        });

        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[0].id).toBe(tasks[firstTaskIndex].id);
        expect(result.tasks[1].id).toBe(tasks[secondTaskIndex].id);
      }
    );

    it("should return empty results when no tasks match", async () => {
      const result = await findTasks(prismaClient, mockUserId, {
        skip: 0,
        take: 10,
        orderBy: "createdAt",
        orderDirection: "desc",
        where: {
          category: "nonexistent",
        },
      });

      expect(result.tasks).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
