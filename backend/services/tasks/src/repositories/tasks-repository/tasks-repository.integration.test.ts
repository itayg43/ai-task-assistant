import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  mockNaturalLanguage,
  mockParsedTask,
  mockUserId,
} from "@mocks/tasks-mocks";
import { createTask, findTaskById } from "@repositories/tasks-repository";
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

  describe("createTask", () => {
    it("should create a task and persist it to the database", async () => {
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
    });
  });

  describe("findTaskById", () => {
    it("should find task with subtasks when userId matches", async () => {
      const createdTask = await createTask(
        prismaClient,
        mockUserId,
        mockNaturalLanguage,
        mockParsedTask
      );

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
});
