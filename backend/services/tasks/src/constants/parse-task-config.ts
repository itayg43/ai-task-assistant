import { ParseTaskConfig, ParseTaskConfigScoreRange } from "@types";

const DEFAULT_PRIORITIES_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

const DEFAULT_LEVELS_VALUES = Object.values(DEFAULT_PRIORITIES_LEVELS);

const DEFAULT_PRIORITIES_SCORES: Record<
  (typeof DEFAULT_PRIORITIES_LEVELS)[keyof typeof DEFAULT_PRIORITIES_LEVELS],
  ParseTaskConfigScoreRange
> = {
  low: {
    min: 0,
    max: 3,
  },
  medium: {
    min: 4,
    max: 6,
  },
  high: {
    min: 7,
    max: 8,
  },
  critical: {
    min: 9,
    max: 10,
  },
} as const;

export const DEFAULT_PARSE_TASK_CONFIG: ParseTaskConfig = {
  categories: ["work", "personal", "health", "finance", "errand"],
  priorities: {
    levels: DEFAULT_LEVELS_VALUES,
    scores: DEFAULT_PRIORITIES_SCORES,
    overallScoreRange: {
      min: DEFAULT_PRIORITIES_SCORES.low.min,
      max: DEFAULT_PRIORITIES_SCORES.critical.max,
    },
  },
  frequencies: ["daily", "weekly", "monthly"],
};
