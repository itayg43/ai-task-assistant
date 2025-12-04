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
  mockSubtasks,
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

describe("createTaskHandler", () => {
  let mockedExecuteCapability: Mocked<typeof executeCapability>;
  let mockedCreateTask: Mocked<typeof createTask>;
  let mockedFindTaskById: Mocked<typeof findTaskById>;
  let mockedCreateManySubtasks: Mocked<typeof createManySubtasks>;

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
    mockedCreateTask = vi.mocked(createTask);
    mockedFindTaskById = vi.mocked(findTaskById);
    mockedCreateManySubtasks = vi.mocked(createManySubtasks);

    mockedExecuteCapability.mockResolvedValue(mockAiCapabilityResponse);

    mockedCreateTask.mockResolvedValue(mockTask);
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

  it("should successfully call executeCapability with correct parameters", async () => {
    await executeHandler();

    expect(mockedExecuteCapability).toHaveBeenCalledWith(mockRequestId, {
      capability: "parse-task",
      pattern: "sync",
      params: {
        naturalLanguage: mockNaturalLanguage,
        config: DEFAULT_PARSE_TASK_CONFIG,
      },
    });
  });

  it("should return task with subtasks from database", async () => {
    const result = await executeHandler();

    expect(result).toMatchObject({
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
    expect(result.subtasks).toBeDefined();
  });

  it("should persist task to database using transaction", async () => {
    await executeHandler();

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockedCreateTask).toHaveBeenCalledWith(
      {},
      mockUserId,
      mockNaturalLanguage,
      mockParsedTask
    );
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
    expect(result.subtasks).toHaveLength(2);
    expect(result.subtasks[0].title).toBe("Subtask 1");
    expect(result.subtasks[1].title).toBe("Subtask 2");
  });

  it("should not persist subtasks when they are null", async () => {
    const parsedTaskWithoutSubtasks = {
      ...mockParsedTask,
      subtasks: null,
    };

    mockedExecuteCapability.mockResolvedValue({
      ...mockAiCapabilityResponse,
      result: parsedTaskWithoutSubtasks,
    });

    mockedFindTaskById.mockResolvedValue(mockTaskWithSubtasks);

    const result = await executeHandler();

    expect(mockedCreateManySubtasks).not.toHaveBeenCalled();
    expect(result.subtasks).toEqual([]);
  });

  it("should not persist subtasks when they are empty array", async () => {
    const parsedTaskWithEmptySubtasks = {
      ...mockParsedTask,
      subtasks: [],
    };

    mockedExecuteCapability.mockResolvedValue({
      ...mockAiCapabilityResponse,
      result: parsedTaskWithEmptySubtasks,
    });

    mockedFindTaskById.mockResolvedValue(mockTaskWithSubtasks);

    const result = await executeHandler();

    expect(mockedCreateManySubtasks).not.toHaveBeenCalled();
    expect(result.subtasks).toEqual([]);
  });

  it("should propagate errors from executeCapability", async () => {
    const mockError = new Error("AI service error");
    mockedExecuteCapability.mockRejectedValue(mockError);

    await expect(executeHandler()).rejects.toThrow(mockError);
  });
});
