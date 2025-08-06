export const PRIORITY_LEVEL = ["low", "medium", "high", "critical"] as const;
export const PRIORITY_SCORE = {
  CRITICAL: {
    min: 90,
    max: 100,
    keywords: ["asap", "urgent", "critical", "immediate"],
  },
  HIGH: {
    min: 70,
    max: 89,
    keywords: ["important", "high priority", "specific deadlines"],
  },
  MEDIUM: {
    min: 40,
    max: 69,
    keywords: ["medium priority", "routine"],
  },
  LOW: {
    min: 0,
    max: 39,
    keywords: ["low priority", "when you have time", "vague"],
  },
} as const;

export const CATEGORY = [
  "work",
  "personal",
  "health",
  "finance",
  "errand",
] as const;

export const FREQUENCY = ["daily", "weekly", "monthly"] as const;

export const EMOTIONAL_LANGUAGE = {
  INCREASE: ["i really need", "desperately", "urgently", "must"],
  DECREASE: ["should probably", "when i have time", "maybe", "if possible"],
} as const;

export const VALIDATION_LIMITS = {
  MAX_NATURAL_LANGUAGE_LENGTH: 255,
  MAX_PRIORITY_SCORE: 100,
  MIN_PRIORITY_SCORE: 0,
} as const;
