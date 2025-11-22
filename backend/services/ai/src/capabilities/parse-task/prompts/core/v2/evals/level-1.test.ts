import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskInputConfig } from "@capabilities/parse-task/parse-task-mocks";
import {
  parseTaskOutputCoreSchema,
  parseTaskOutputCoreV2Schema,
} from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskOutputCoreV2 } from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV2 } from "@capabilities/parse-task/prompts/core/v2";
import { executeParse } from "@clients/openai";
import { randomUUID } from "crypto";

const vagueInputTestCases = [
  {
    naturalLanguage: "Plan something soon",
    description: "too generic, no specific task",
  },
  {
    naturalLanguage: "Do stuff",
    description: "completely vague, no actionable task",
  },
  {
    naturalLanguage: "Fix it",
    description: "missing context about what to fix",
  },
] as const;

const clearInputTestCases = [
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
  const prompt = parseTaskCorePromptV2(
    naturalLanguage,
    mockParseTaskInputConfig
  );

  return await executeParse<ParseTaskOutputCoreV2>(
    "parse-task",
    naturalLanguage,
    prompt,
    "v2",
    randomUUID()
  );
};

describe("corePromptV2 - Level1Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("vague inputs - should return error", () => {
    it.each(vagueInputTestCases)(
      "should return error for vague input: $naturalLanguage ($description)",
      async ({ naturalLanguage }) => {
        const { output } = await executeParseTask(naturalLanguage);

        expect(() => parseTaskOutputCoreV2Schema.parse(output)).not.toThrow();

        expect(output.success).toBe(false);
        expect(output.task).toBeNull();
        expect(output.error).not.toBeNull();

        expect(output.error?.reason).toBeTruthy();
        expect(output.error?.reason.trim().length).toBeGreaterThan(0);
        expect(output.error?.suggestions).toBeInstanceOf(Array);
        expect(output.error?.suggestions.length).toBeGreaterThanOrEqual(1);
        expect(output.error?.suggestions.length).toBeLessThanOrEqual(3);
        output.error?.suggestions.forEach((suggestion) => {
          expect(suggestion.trim().length).toBeGreaterThan(0);
        });
      }
    );
  });

  describe("clear inputs - should parse successfully", () => {
    it.each(clearInputTestCases)(
      "should parse $naturalLanguage",
      async ({ naturalLanguage, expected }) => {
        const { output } = await executeParseTask(naturalLanguage);

        expect(() => parseTaskOutputCoreV2Schema.parse(output)).not.toThrow();

        expect(output.success).toBe(true);
        expect(output.error).toBeNull();
        expect(output.task).not.toBeNull();

        expect(() =>
          parseTaskOutputCoreSchema.parse(output.task)
        ).not.toThrow();

        const task = output.task!;

        expect(task.title.toLowerCase()).toContain(expected.title.contains);

        if (expected.dueDate && task.dueDate) {
          const actualDate = new Date(task.dueDate).toISOString().split("T")[0];

          expect(actualDate).toBe(expected.dueDate);
        } else {
          expect(task.dueDate).toBeNull();
        }

        expect(expected.category).toContain(task.category);

        expect(expected.priority.level).toContain(task.priority.level);
        expect(task.priority.score).toBeGreaterThanOrEqual(
          expected.priority.minScore
        );
        expect(task.priority.score).toBeLessThanOrEqual(
          expected.priority.maxScore
        );
        expect(task.priority.reason).toBeTruthy();
      }
    );
  });
});
