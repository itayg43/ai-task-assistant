import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockPrismaClient,
  type MockPrismaClient,
} from "@mocks/prisma-mock";
import { mockTask, mockUserId } from "@mocks/tasks-mocks";
import { createManySubtasks } from "@repositories/subtasks-repository";
import { PrismaClient } from "@shared/clients/prisma";

describe("subtasksRepository", () => {
  let mockPrismaClient: MockPrismaClient;

  beforeEach(() => {
    mockPrismaClient = createMockPrismaClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createManySubtasks", () => {
    it.each([
      {
        name: "multiple subtasks",
        subtasks: [
          "Gather Data For Report",
          "Write Q2 Report",
          "Review Report",
          "Submit Q2 Report",
        ],
      },
      {
        name: "single subtask",
        subtasks: ["Buy groceries"],
      },
      {
        name: "empty array",
        subtasks: [] as string[],
      },
    ])("should handle $name correctly", async ({ subtasks }) => {
      const mockResult = {
        count: subtasks.length,
      };
      mockPrismaClient.subtask.createMany.mockResolvedValue(mockResult);

      const result = await createManySubtasks(
        mockPrismaClient as unknown as PrismaClient,
        mockTask.id,
        mockUserId,
        subtasks
      );

      const expectedData = subtasks.map((title, idx) => ({
        taskId: mockTask.id,
        userId: mockUserId,
        title,
        order: idx,
      }));

      expect(mockPrismaClient.subtask.createMany).toHaveBeenCalledWith({
        data: expectedData,
      });
      expect(result).toEqual(mockResult);
    });
  });
});
