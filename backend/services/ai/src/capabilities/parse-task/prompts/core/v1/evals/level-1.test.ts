import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskInputConfig } from "@capabilities/parse-task/parse-task-mocks";
import { parseTaskOutputCoreSchema } from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskOutputCore } from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV1 } from "@capabilities/parse-task/prompts/core/v1";
import { executeParse } from "@clients/openai";
import { randomUUID } from "crypto";

const testCases = [
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
] as const;

const executeParseTask = async (naturalLanguage: string) => {
  const prompt = parseTaskCorePromptV1(
    naturalLanguage,
    mockParseTaskInputConfig
  );

  return await executeParse<ParseTaskOutputCore>(
    "parse-task",
    naturalLanguage,
    prompt,
    "v1",
    randomUUID()
  );
};

describe("corePromptV1 - Level1Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(testCases)(
    "should parse $naturalLanguage",
    async ({ naturalLanguage, expected }) => {
      const { output } = await executeParseTask(naturalLanguage);

      expect(() => parseTaskOutputCoreSchema.parse(output)).not.toThrow();

      expect(output.title.toLowerCase()).toContain(expected.title.contains);

      if (expected.dueDate && output.dueDate) {
        const actualDate = new Date(output.dueDate).toISOString().split("T")[0];

        expect(actualDate).toBe(expected.dueDate);
      } else {
        expect(output.dueDate).toBeNull();
      }

      expect(expected.category).toContain(output.category);

      expect(expected.priority.level).toContain(output.priority.level);
      expect(output.priority.score).toBeGreaterThanOrEqual(
        expected.priority.minScore
      );
      expect(output.priority.score).toBeLessThanOrEqual(
        expected.priority.maxScore
      );
      expect(output.priority.reason).toBeTruthy();
    }
  );
});
