import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskOutputCoreSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInputConfig,
  ParseTaskOutputCore,
} from "@capabilities/parse-task/parse-task-types";
import { executeParse } from "@clients/openai";
import { parseTaskCorePromptV1 } from "./parse-task-core-prompt-v1";

type TestCase = {
  naturalLanguage: string;
  expected: {
    title: {
      contains: string;
    };
    dueDate: string | null;
    category: string[];
    priority: {
      level: string[];
      minScore: number;
      maxScore: number;
    };
  };
};

const mockConfig: ParseTaskInputConfig = {
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

const testCases: TestCase[] = [
  {
    naturalLanguage: "Plan something soon",
    expected: {
      title: {
        contains: "plan",
      },
      dueDate: null,
      category: ["work", "personal"],
      priority: {
        level: ["low"],
        minScore: 0,
        maxScore: 3,
      },
    },
  },
  {
    naturalLanguage: "Fix broken laptop screen",
    expected: {
      title: {
        contains: "fix",
      },
      dueDate: null,
      category: ["work", "personal"],
      priority: {
        level: ["medium", "high"],
        minScore: 4,
        maxScore: 8,
      },
    },
  },
  {
    naturalLanguage: "Buy birthday gift for mom",
    expected: {
      title: {
        contains: "buy",
      },
      dueDate: null,
      category: ["errand", "personal"],
      priority: {
        level: ["low", "medium"],
        minScore: 0,
        maxScore: 6,
      },
    },
  },
  {
    naturalLanguage: "Book dentist appointment",
    expected: {
      title: {
        contains: "book",
      },
      dueDate: null,
      category: ["health"],
      priority: {
        level: ["medium", "high"],
        minScore: 4,
        maxScore: 8,
      },
    },
  },
  {
    naturalLanguage: "Pay electricity bill tomorrow",
    expected: {
      title: {
        contains: "pay",
      },
      dueDate: "2024-01-16",
      category: ["finance"],
      priority: {
        level: ["medium", "high"],
        minScore: 4,
        maxScore: 8,
      },
    },
  },
  {
    naturalLanguage: "Schedule team sync every Monday at 9am",
    expected: {
      title: {
        contains: "schedule",
      },
      dueDate: null,
      category: ["work"],
      priority: {
        level: ["medium", "high"],
        minScore: 4,
        maxScore: 8,
      },
    },
  },
  {
    naturalLanguage: "Update resume and apply for jobs",
    expected: {
      title: {
        contains: "update",
      },
      dueDate: null,
      category: ["work"],
      priority: {
        level: ["medium", "high"],
        minScore: 4,
        maxScore: 8,
      },
    },
  },
  {
    naturalLanguage:
      "Submit Q2 report by next Friday and mark it high priority under Work",
    expected: {
      title: {
        contains: "submit",
      },
      dueDate: "2024-01-19",
      category: ["work"],
      priority: {
        level: ["high"],
        minScore: 7,
        maxScore: 8,
      },
    },
  },
];

describe("ParseTaskCorePromptV1 - Level1Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const executeParseTask = async (naturalLanguage: string) => {
    const prompt = parseTaskCorePromptV1(naturalLanguage, mockConfig);
    const response = await executeParse<ParseTaskOutputCore>(prompt);

    if (!response.output_parsed) {
      throw new Error(`Failed to parse: ${naturalLanguage}`);
    }

    return response.output_parsed;
  };

  it.each(testCases)(
    "should parse $naturalLanguage",
    async ({ naturalLanguage, expected }) => {
      const result = await executeParseTask(naturalLanguage);

      expect(() => parseTaskOutputCoreSchema.parse(result)).not.toThrow();

      expect(result.title.toLowerCase()).toContain(expected.title.contains);

      if (expected.dueDate && result.dueDate) {
        const actualDate = new Date(result.dueDate).toISOString().split("T")[0];

        expect(actualDate).toBe(expected.dueDate);
      } else {
        expect(result.dueDate).toBeNull();
      }

      expect(expected.category).toContain(result.category);

      expect(expected.priority.level).toContain(result.priority.level);
      expect(result.priority.score).toBeGreaterThanOrEqual(
        expected.priority.minScore
      );
      expect(result.priority.score).toBeLessThanOrEqual(
        expected.priority.maxScore
      );
      expect(result.priority.reason).toBeTruthy();
    }
  );
});
