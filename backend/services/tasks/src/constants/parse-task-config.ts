import { ParseTaskConfig } from "@types";

const DEFAULT_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

const DEFAULT_LEVELS_VALUES = Object.values(DEFAULT_LEVELS);

export const DEFAULT_PARSE_TASK_CONFIG: ParseTaskConfig = {
  categories: ["work", "personal", "health", "finance", "errand"],
  priorities: {
    levels: DEFAULT_LEVELS_VALUES,
    scores: {
      [DEFAULT_LEVELS.LOW]: {
        min: 0,
        max: 3,
      },
      [DEFAULT_LEVELS.MEDIUM]: {
        min: 4,
        max: 6,
      },
      [DEFAULT_LEVELS.HIGH]: {
        min: 7,
        max: 8,
      },
      [DEFAULT_LEVELS.CRITICAL]: {
        min: 9,
        max: 10,
      },
    },
    overallScoreRange: {
      min: 0,
      max: 10,
    },
  },
  frequencies: ["daily", "weekly", "monthly"],
};
