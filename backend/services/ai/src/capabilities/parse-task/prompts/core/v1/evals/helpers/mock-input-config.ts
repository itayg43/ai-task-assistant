import { ParseTaskInputConfig } from "@capabilities/parse-task/parse-task-types";

export const mockInputConfig: ParseTaskInputConfig = {
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
