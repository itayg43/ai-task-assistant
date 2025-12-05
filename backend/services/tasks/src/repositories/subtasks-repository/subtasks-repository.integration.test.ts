import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  mockNaturalLanguage,
  mockParsedTask,
  mockUserId,
} from "@mocks/tasks-mocks";
import { createManySubtasks } from "@repositories/subtasks-repository";
import { createTask } from "@repositories/tasks-repository";
import { createPrismaClient } from "@shared/clients/prisma";

describe("subtasksRepository (integration)", () => {
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

  describe("createManySubtasks", () => {
    it("should create multiple subtasks and persist them to the database", async () => {
      const createdTask = await createTask(
        prismaClient,
        mockUserId,
        mockNaturalLanguage,
        mockParsedTask
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.id).toBeDefined();

      const subtasks = [
        "Gather Data For Report",
        "Write Q2 Report",
        "Review Report",
        "Submit Q2 Report",
      ];

      await createManySubtasks(
        prismaClient,
        createdTask.id,
        mockUserId,
        subtasks
      );

      const foundSubtasks = await prismaClient.subtask.findMany({
        where: {
          taskId: createdTask.id,
        },
        orderBy: {
          order: "asc",
        },
      });

      expect(foundSubtasks).toHaveLength(subtasks.length);
      foundSubtasks.forEach((subtask, index) => {
        expect(subtask.title).toBe(subtasks[index]);
        expect(subtask.order).toBe(index);
        expect(subtask.taskId).toBe(createdTask.id);
        expect(subtask.userId).toBe(mockUserId);
      });
    });

    it("should handle empty array", async () => {
      const createdTask = await createTask(
        prismaClient,
        mockUserId,
        mockNaturalLanguage,
        mockParsedTask
      );

      expect(createdTask).toBeDefined();
      expect(createdTask.id).toBeDefined();

      await createManySubtasks(prismaClient, createdTask.id, mockUserId, []);

      const foundSubtasks = await prismaClient.subtask.findMany({
        where: {
          taskId: createdTask.id,
        },
      });

      expect(foundSubtasks).toHaveLength(0);
    });
  });
});
