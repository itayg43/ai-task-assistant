import { PARSE_TASK_VAGUE_INPUT_ERROR } from "@constants";
import { type Subtask } from "@repositories/subtasks-repository";
import {
  type FindTasksResult,
  type Task,
  type TaskWithSubtasks,
} from "@repositories/tasks-repository";
import { GetTasksInput } from "@schemas/tasks-schemas";
import { TAiCapabilityResponse, TAiErrorData, TParsedTask } from "@types";

export const mockNaturalLanguage = "Submit Q2 report by next Friday";

export const mockRequestId = "test-request-id-123";

export const mockParsedTask: TParsedTask = {
  title: "Submit Q2 report",
  dueDate: "2024-01-19T23:59:59Z",
  category: "work",
  priority: {
    level: "high",
    score: 8,
    reason: "Marked as high priority with a clear deadline next Friday.",
  },
  subtasks: null,
};

export const mockAiCapabilityResponse: TAiCapabilityResponse<TParsedTask> = {
  openaiMetadata: {
    core: {
      responseId: "openai-response-id-123",
      tokens: {
        input: 100,
        output: 50,
      },
      durationMs: 500,
    },
  },
  result: mockParsedTask,
  aiServiceRequestId: "ai-service-request-id-123",
};

export const mockAiErrorData: TAiErrorData = {
  message:
    "The input is too vague - it doesn't specify what needs to be planned.",
  type: PARSE_TASK_VAGUE_INPUT_ERROR,
  suggestions: [
    "What specifically needs to be planned? (e.g., 'Plan vacation', 'Plan team meeting')",
    "What is the context or category? (work, personal, etc.)",
  ],
};

export const mockAiErrorDataWithoutType: TAiErrorData = {
  message: "Invalid input provided",
};

export const mockUserId = 1;

export const mockTask: Task = {
  id: 1,
  userId: mockUserId,
  naturalLanguage: mockNaturalLanguage,
  title: mockParsedTask.title,
  dueDate: mockParsedTask.dueDate ? new Date(mockParsedTask.dueDate) : null,
  category: mockParsedTask.category,
  priorityLevel: mockParsedTask.priority.level,
  priorityScore: mockParsedTask.priority.score,
  priorityReason: mockParsedTask.priority.reason,
  createdAt: new Date("2024-01-19T00:00:00Z"),
  updatedAt: new Date("2024-01-19T00:00:00Z"),
};

export const mockTaskWithSubtasks: TaskWithSubtasks = {
  ...mockTask,
  subtasks: [],
};

export const mockSubtasks: Subtask[] = [
  {
    id: 1,
    taskId: mockTask.id,
    userId: mockUserId,
    title: "Subtask 1",
    order: 0,
    createdAt: new Date("2024-01-19T00:00:00Z"),
    updatedAt: new Date("2024-01-19T00:00:00Z"),
  },
  {
    id: 2,
    taskId: mockTask.id,
    userId: mockUserId,
    title: "Subtask 2",
    order: 1,
    createdAt: new Date("2024-01-19T00:00:00Z"),
    updatedAt: new Date("2024-01-19T00:00:00Z"),
  },
];

export const mockTaskWithSubtasksWithItems: TaskWithSubtasks = {
  ...mockTask,
  subtasks: mockSubtasks,
};

export const mockGetTasksInputQuery: GetTasksInput["query"] = {
  skip: 0,
  take: 10,
  orderBy: "createdAt",
  orderDirection: "desc",
};

export const mockFindTasksResult: FindTasksResult = {
  tasks: [mockTaskWithSubtasks],
  totalCount: 1,
  hasMore: false,
};
