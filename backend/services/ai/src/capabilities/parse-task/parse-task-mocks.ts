import {
  ParseTaskInputConfig,
  ParseTaskOutput,
  ParseTaskOutputCore,
} from "@capabilities/parse-task/parse-task-types";

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
  frequencies: ["daily", "weekly", "monthly"],
};

const mockParseTaskOutputCore: ParseTaskOutputCore = {
  title: "Submit Q2 report",
  dueDate: "2024-01-19T23:59:59Z",
  category: "work",
  priority: {
    level: "high",
    score: 88,
    reason: "Marked as high priority with a clear deadline next Friday.",
  },
};

export const mockParseTaskOutput: ParseTaskOutput = {
  ...mockParseTaskOutputCore,
};
