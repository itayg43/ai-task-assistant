import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PARSE_TASK_CONFIG } from "@constants";
import {
  mockAiCapabilityResponse,
  mockNaturalLanguage,
  mockParsedTask,
  mockRequestId,
  mockTask,
  mockTaskWithSubtasks,
  mockTaskWithSubtasksWithItems,
  mockUserId,
} from "@mocks/tasks-mocks";
import { createManySubtasks } from "@repositories/subtasks-repository";
import { createTask, findTaskById } from "@repositories/tasks-repository";
import { executeCapability } from "@services/ai-capabilities-service";
import { createTaskHandler } from "@services/tasks-service";
import { Mocked } from "@shared/types";

vi.mock("@services/ai-capabilities-service", () => ({
  executeCapability: vi.fn(),
}));

vi.mock("@repositories/tasks-repository", () => ({
  createTask: vi.fn(),
  findTaskById: vi.fn(),
}));

vi.mock("@repositories/subtasks-repository", () => ({
  createManySubtasks: vi.fn(),
}));

vi.mock("@clients/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe("tasksService", () => {
  describe("createTaskHandler", () => {
    let mockedExecuteCapability: Mocked<typeof executeCapability>;

    let mockedCreateTask: Mocked<typeof createTask>;
    let mockedCreateManySubtasks: Mocked<typeof createManySubtasks>;
    let mockedFindTaskById: Mocked<typeof findTaskById>;

    let mockTransaction: ReturnType<typeof vi.fn>;

    const executeHandler = async () => {
      return await createTaskHandler(
        mockRequestId,
        mockUserId,
        mockNaturalLanguage
      );
    };

    beforeEach(async () => {
      mockedExecuteCapability = vi.mocked(executeCapability);
      mockedExecuteCapability.mockResolvedValue(mockAiCapabilityResponse);

      mockedCreateTask = vi.mocked(createTask);
      mockedCreateTask.mockResolvedValue(mockTask);
      mockedCreateManySubtasks = vi.mocked(createManySubtasks);
      mockedFindTaskById = vi.mocked(findTaskById);
      mockedFindTaskById.mockResolvedValue(mockTaskWithSubtasks);

      mockTransaction = vi.fn(async (callback) => {
        return await callback({});
      });
      const { prisma } = await import("@clients/prisma");
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should propagate errors from executeCapability", async () => {
      const mockError = new Error("AI service error");
      mockedExecuteCapability.mockRejectedValue(mockError);

      await expect(executeHandler()).rejects.toThrow(mockError);
    });

    it("should successfully create task and return it with token usage", async () => {
      const result = await executeHandler();

      expect(mockedExecuteCapability).toHaveBeenCalledWith(mockRequestId, {
        capability: "parse-task",
        pattern: "sync",
        params: {
          naturalLanguage: mockNaturalLanguage,
          config: DEFAULT_PARSE_TASK_CONFIG,
        },
      });
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockedCreateTask).toHaveBeenCalledWith(
        {},
        mockUserId,
        mockNaturalLanguage,
        mockParsedTask
      );
      expect(mockedFindTaskById).toHaveBeenCalledWith(
        expect.any(Object),
        mockTask.id,
        mockUserId
      );
      expect(result.task).toMatchObject({
        id: 1,
        userId: mockUserId,
        naturalLanguage: mockNaturalLanguage,
        title: mockParsedTask.title,
        category: mockParsedTask.category,
        priorityLevel: mockParsedTask.priority.level,
        priorityScore: mockParsedTask.priority.score,
        priorityReason: mockParsedTask.priority.reason,
        subtasks: [],
      });
      expect(result.tokensUsed).toBe(150);
    });

    it("should persist subtasks when they exist", async () => {
      const parsedTaskWithSubtasks = {
        ...mockParsedTask,
        subtasks: ["Subtask 1", "Subtask 2"],
      };

      mockedExecuteCapability.mockResolvedValue({
        ...mockAiCapabilityResponse,
        result: parsedTaskWithSubtasks,
      });

      mockedFindTaskById.mockResolvedValue(mockTaskWithSubtasksWithItems);

      const result = await executeHandler();

      expect(mockedCreateManySubtasks).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        mockUserId,
        parsedTaskWithSubtasks.subtasks
      );
      expect(result.task.subtasks).toHaveLength(2);
      expect(result.task.subtasks[0].title).toBe("Subtask 1");
      expect(result.task.subtasks[1].title).toBe("Subtask 2");
      expect(result.tokensUsed).toBe(150);
    });

    it.each([
      {
        description: "null",
        subtasks: null,
      },
      {
        description: "empty array",
        subtasks: [],
      },
    ])(
      "should not persist subtasks when they are $description",
      async ({ subtasks }) => {
        const parsedTaskWithoutSubtasks = {
          ...mockParsedTask,
          subtasks,
        };

        mockedExecuteCapability.mockResolvedValue({
          ...mockAiCapabilityResponse,
          result: parsedTaskWithoutSubtasks,
        });

        mockedFindTaskById.mockResolvedValue(mockTaskWithSubtasks);

        const result = await executeHandler();

        expect(mockedCreateManySubtasks).not.toHaveBeenCalled();
        expect(result.task.subtasks).toEqual([]);
        expect(result.tokensUsed).toBe(150);
      }
    );

    describe("transaction rollback", () => {
      beforeEach(() => {
        mockTransaction.mockImplementation(async (callback) => {
          try {
            return await callback({});
          } catch (error) {
            throw error;
          }
        });
      });

      it("should rollback transaction when task creation fails", async () => {
        const taskError = new Error("Task creation failed");
        mockedCreateTask.mockRejectedValue(taskError);

        await expect(executeHandler()).rejects.toThrow(taskError);

        expect(mockedCreateTask).toHaveBeenCalled();
        expect(mockedCreateManySubtasks).not.toHaveBeenCalled();
      });

      it("should rollback transaction when subtask creation fails", async () => {
        const parsedTaskWithSubtasks = {
          ...mockParsedTask,
          subtasks: ["Subtask 1", "Subtask 2"],
        };

        mockedExecuteCapability.mockResolvedValue({
          ...mockAiCapabilityResponse,
          result: parsedTaskWithSubtasks,
        });

        const subtaskError = new Error("Subtask creation failed");
        mockedCreateManySubtasks.mockRejectedValue(subtaskError);

        await expect(executeHandler()).rejects.toThrow(subtaskError);

        expect(mockedCreateTask).toHaveBeenCalled();
        expect(mockedCreateManySubtasks).toHaveBeenCalled();
        expect(mockedFindTaskById).not.toHaveBeenCalled();
      });
    });
  });
});
