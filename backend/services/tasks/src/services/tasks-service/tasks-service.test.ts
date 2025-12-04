import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PARSE_TASK_CONFIG } from "@constants";
import {
  mockAiCapabilityResponse,
  mockNaturalLanguage,
  mockParsedTask,
  mockRequestId,
} from "@mocks/tasks-mocks";
import { createManySubtasks } from "@repositories/subtasks-repository";
import { createTask, type Task } from "@repositories/tasks-repository";
import { executeCapability } from "@services/ai-capabilities-service";
import { createTaskHandler } from "@services/tasks-service";
import { Mocked } from "@shared/types";

vi.mock("@services/ai-capabilities-service", () => ({
  executeCapability: vi.fn(),
}));

vi.mock("@repositories/tasks-repository", () => ({
  createTask: vi.fn(),
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
  let mockedCreateManySubtasks: Mocked<typeof createManySubtasks>;

  let mockTransaction: ReturnType<typeof vi.fn>;

  const mockUserId = 1;

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
    mockedCreateManySubtasks = vi.mocked(createManySubtasks);

    mockedExecuteCapability.mockResolvedValue(mockAiCapabilityResponse);

    mockTransaction = vi.fn(async (callback) => {
      return await callback({});
    });

    const { prisma } = await import("@clients/prisma");
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

    const mockTask: Task = {
      id: 1,
      userId: mockUserId,
      naturalLanguage: mockNaturalLanguage,
      title: mockParsedTask.title,
      dueDate: mockParsedTask.dueDate ? new Date(mockParsedTask.dueDate) : null,
      category: mockParsedTask.category,
      priorityLevel: mockParsedTask.priority.level,
      priorityScore: mockParsedTask.priority.score,
      priorityReason: mockParsedTask.priority.reason,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedCreateTask.mockResolvedValue(mockTask);
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

  it("should return parsed task result from AI capability response", async () => {
    const result = await executeHandler();

    expect(result).toEqual(mockParsedTask);
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

    await executeHandler();

    expect(mockedCreateManySubtasks).toHaveBeenCalledWith(
      {},
      1,
      mockUserId,
      parsedTaskWithSubtasks.subtasks
    );
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

    await executeHandler();

    expect(mockedCreateManySubtasks).not.toHaveBeenCalled();
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

    await executeHandler();

    expect(mockedCreateManySubtasks).not.toHaveBeenCalled();
  });

  it("should propagate errors from executeCapability", async () => {
    const mockError = new Error("AI service error");
    mockedExecuteCapability.mockRejectedValue(mockError);

    await expect(executeHandler()).rejects.toThrow(mockError);
  });
});
