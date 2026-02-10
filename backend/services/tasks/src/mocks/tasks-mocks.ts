import { AI_ERROR_TYPE, DEFAULT_PARSE_TASK_CONFIG } from "@constants";
import type { Subtask } from "@repositories/subtasks-repository";
import type {
  FindTasksResult,
  Task,
  TaskWithSubtasks,
} from "@repositories/tasks-repository";
import type {
  GetTasksInput,
  TAiCapabilityImmediateResponse,
  TAiCapabilityResponse,
  TCreateTaskAiErrorContext,
  TExecuteCapabilityConfig,
  TParsedTask,
} from "@types";

export const mockNaturalLanguage = "Submit Q2 report by next Friday";

export const mockRequestId = "test-request-id-123";
export const mockTasksServiceRequestId = "550e8400-e29b-41d4-a716-446655440000";

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

export const mockAiCapabilityImmediateResponse: TAiCapabilityImmediateResponse =
  {
    message: "The request has been received and will be executed shortly.",
    aiServiceRequestId: "ai-service-request-id-123",
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

export const mockParseTaskVagueInputErrorData: Extract<
  TCreateTaskAiErrorContext,
  { type: typeof AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR }
> = {
  type: AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR,
  suggestions: [
    "What specifically needs to be planned? (e.g., 'Plan vacation', 'Plan team meeting')",
    "What is the context or category? (work, personal, etc.)",
  ],
  openaiMetadata: mockAiCapabilityResponse.openaiMetadata,
};

export const mockPromptInjectionErrorData: Extract<
  TCreateTaskAiErrorContext,
  { type: typeof AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED }
> = {
  type: AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED,
};

export const mockUserId = 1;

export const mockTask: Task = {
  id: 1,
  userId: mockUserId,
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

export const mockTokenUsage = {
  tokensReserved: 100,
  windowStartTimestamp: 1000000,
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
  currentPage: 1,
  totalPages: 1,
};

export const mockParsedTaskExecuteCapabilityConfig: TExecuteCapabilityConfig<"parse-task"> =
  {
    capability: "parse-task",
    callbackUrl: `http://tasks:3001/api/v1/webhooks/create-task?tasksServiceRequestId=${mockRequestId}`,
    params: {
      naturalLanguage: mockNaturalLanguage,
      config: DEFAULT_PARSE_TASK_CONFIG,
    },
  };
