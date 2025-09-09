import { ParseTaskConfig } from "@types";

export const DEFAULT_PARSE_TASK_CONFIG: ParseTaskConfig = {
  categories: ["work", "personal", "health", "finance", "errand"],
  priorities: {
    levels: ["low", "medium", "high", "critical"],
    overallScoreRange: {
      min: 0,
      max: 10,
    },
  },
  frequencies: ["daily", "weekly", "monthly"],
};
