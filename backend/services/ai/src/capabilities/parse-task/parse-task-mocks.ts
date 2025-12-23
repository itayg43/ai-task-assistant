import {
  parseTaskInputSchema,
  parseTaskOutputSchema,
} from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInput,
  ParseTaskInputConfig,
  ParseTaskOutput,
  ParseTaskOutputCore,
  ParseTaskOutputCoreV2,
  ParseTaskOutputSubtasks,
} from "@capabilities/parse-task/parse-task-types";
import { CAPABILITY, CAPABILITY_PATTERN } from "@constants";
import {
  mockOpenaiDurationMs,
  mockOpenaiResponseId,
  mockOpenaiTokenUsage,
} from "@mocks/openai-mocks";
import { createCapabilityResponseSchema } from "@schemas";
import { CapabilityConfig, CapabilityResponse } from "@types";

export const mockNaturalLanguage = "Submit Q2 report by next Friday";

export const mockParseTaskInputConfig: ParseTaskInputConfig = {
  categories: ["work", "personal", "health", "finance", "errand"],
  priorities: {
    levels: ["low", "medium", "high", "critical"],
    scores: {
      low: { min: 0, max: 3 },
      medium: { min: 4, max: 6 },
      high: { min: 7, max: 8 },
      critical: { min: 9, max: 10 },
    },
    overallScoreRange: { min: 0, max: 10 },
  },
};

export const mockParseTaskOutputCore: ParseTaskOutputCore = {
  title: "Submit Q2 report",
  dueDate: "2024-01-19T23:59:59Z",
  category: "work",
  priority: {
    level: "high",
    score: 88,
    reason: "Marked as high priority with a clear deadline next Friday.",
  },
};

export const mockParseTaskErrorOutputCoreV2: ParseTaskOutputCoreV2 = {
  success: false,
  task: null,
  error: {
    reason:
      "The input is too vague - it doesn't specify what needs to be planned.",
    suggestions: [
      "What specifically needs to be planned? (e.g., 'Plan vacation', 'Plan team meeting')",
      "What is the context or category? (work, personal, etc.)",
    ],
  },
};

export const mockParseTaskSuccessOutputCoreV2: ParseTaskOutputCoreV2 = {
  success: true,
  task: mockParseTaskOutputCore,
  error: null,
};

export const mockParseTaskOutputSubtasks: ParseTaskOutputSubtasks = {
  subtasks: null,
};

export const mockParseTaskOutput: ParseTaskOutput = {
  ...mockParseTaskOutputCore,
  subtasks: null,
};

export const mockParseTaskCapabilityResponse: CapabilityResponse<
  typeof parseTaskOutputSchema
> = {
  openaiMetadata: {
    core: {
      responseId: mockOpenaiResponseId,
      tokens: mockOpenaiTokenUsage,
      durationMs: mockOpenaiDurationMs,
    },
  },
  result: mockParseTaskOutput,
};

export const mockParseTaskValidatedInput: ParseTaskInput = {
  params: {
    capability: CAPABILITY.PARSE_TASK,
  },
  query: {
    pattern: CAPABILITY_PATTERN.SYNC,
  },
  body: {
    naturalLanguage: mockNaturalLanguage,
    config: mockParseTaskInputConfig,
  },
};

export const mockParseTaskCapabilityConfig: CapabilityConfig<any, any> = {
  name: CAPABILITY.PARSE_TASK,
  handler: async () => mockParseTaskCapabilityResponse,
  inputSchema: parseTaskInputSchema,
  outputSchema: createCapabilityResponseSchema(parseTaskOutputSchema),
  promptInjectionFields: ["body.naturalLanguage"],
};
