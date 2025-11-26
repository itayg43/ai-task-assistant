import { PARSE_TASK_VAGUE_INPUT_ERROR } from "@constants";
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
