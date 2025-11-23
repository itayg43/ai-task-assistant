import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PARSE_TASK_CAPABILITY,
  PARSE_TASK_SUBTASKS_OPERATION,
} from "@capabilities/parse-task/parse-task-constants";
import { parseTaskOutputSubtasksSchema } from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskOutputSubtasks } from "@capabilities/parse-task/parse-task-types";
import { parseTaskSubtasksPromptV1 } from "@capabilities/parse-task/prompts/subtasks/v1";
import { executeParse } from "@clients/openai";

const testCases = [
  {
    naturalLanguage: "Plan vacation",
    expected: {
      subtasks: {
        length: { min: 3, max: 7 },
        contains: ["research", "book", "reserve", "plan", "pack"],
      },
    },
  },
  {
    naturalLanguage: "Update resume and apply for jobs",
    expected: {
      subtasks: {
        length: { min: 2, max: 7 },
        contains: ["update", "apply"],
      },
    },
  },
  {
    naturalLanguage: "Buy groceries",
    expected: {
      subtasks: null,
    },
  },
  {
    naturalLanguage: "Fix broken laptop screen",
    expected: {
      subtasks: null,
    },
  },
  {
    naturalLanguage: "Prepare for meeting",
    expected: {
      subtasks: {
        length: { min: 3, max: 7 },
        contains: ["review", "gather", "prepare", "confirm"],
      },
    },
  },
  {
    naturalLanguage: "Submit Q2 report by next Friday",
    expected: {
      subtasks: {
        length: { min: 3, max: 7 },
        contains: ["gather", "write", "review", "submit"],
      },
    },
  },
  {
    naturalLanguage: "Organize party",
    expected: {
      subtasks: {
        length: { min: 3, max: 7 },
        contains: ["send", "plan", "prepare", "organize"],
      },
    },
  },
] as const;

const executeParseSubtasks = async (naturalLanguage: string) => {
  const prompt = parseTaskSubtasksPromptV1(naturalLanguage);

  return await executeParse<ParseTaskOutputSubtasks>(
    PARSE_TASK_CAPABILITY,
    PARSE_TASK_SUBTASKS_OPERATION,
    naturalLanguage,
    prompt,
    "v1",
    randomUUID()
  );
};

describe("subtasksPromptV1 - Level1Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(testCases)(
    "should parse subtasks for $naturalLanguage",
    async ({ naturalLanguage, expected }) => {
      const { output } = await executeParseSubtasks(naturalLanguage);

      expect(() => parseTaskOutputSubtasksSchema.parse(output)).not.toThrow();

      const subtasks = output.subtasks;

      if (expected.subtasks === null) {
        expect(subtasks).toBeNull();
      } else {
        expect(subtasks).not.toBeNull();
        expect(Array.isArray(subtasks)).toBe(true);

        if (subtasks) {
          expect(subtasks.length).toBeGreaterThanOrEqual(
            expected.subtasks.length.min
          );
          expect(subtasks.length).toBeLessThanOrEqual(
            expected.subtasks.length.max
          );

          const subtasksLower = subtasks.map((s: string) => s.toLowerCase());
          expected.subtasks.contains.forEach((keyword) => {
            const found = subtasksLower.some((subtask: string) =>
              subtask.includes(keyword)
            );
            expect(found).toBe(true);
          });
        }
      }
    }
  );
});
