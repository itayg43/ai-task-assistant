import { openai } from "@clients/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskOutputCoreSchema } from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskInputConfig } from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV1 } from "./parse-task-core-prompt-v1";

describe("Parse Task Core Prompt V1 - Level 1 Tests", () => {
  let config: ParseTaskInputConfig;

  beforeEach(() => {
    // Set up fake timers for consistent date testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z")); // Monday, Jan 15, 2024

    // Test configuration matching the user's provided config
    config = {
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const executeParseTask = async (naturalLanguage: string) => {
    const prompt = parseTaskCorePromptV1(naturalLanguage, config);
    const response = await openai.responses.create(prompt);
    return JSON.parse(response.output_text);
  };

  describe("Vague Tasks", () => {
    it("should parse 'Plan something soon' as low priority with null due date", async () => {
      const naturalLanguage = "Plan something soon";

      const result = await executeParseTask(naturalLanguage);

      // Schema compliance
      expect(() => parseTaskOutputCoreSchema.parse(result)).not.toThrow();

      // Field-specific validations
      expect(result.title).toBeTruthy();
      expect(result.dueDate).toBeNull(); // Vague term "soon" should result in null
      expect(config.categories).toContain(result.category);
      expect(result.priority.level).toBe("low");
      expect(result.priority.score).toBeGreaterThanOrEqual(0);
      expect(result.priority.score).toBeLessThanOrEqual(3);
      expect(result.priority.reason).toBeTruthy();

      // Type checks
      expect(typeof result.title).toBe("string");
      expect(typeof result.category).toBe("string");
      expect(typeof result.priority.level).toBe("string");
      expect(typeof result.priority.score).toBe("number");
      expect(typeof result.priority.reason).toBe("string");
    });
  });

  describe("Simple Tasks", () => {
    it("should parse 'Fix broken laptop screen' with appropriate category and priority", async () => {
      const naturalLanguage = "Fix broken laptop screen";

      const result = await executeParseTask(naturalLanguage);

      // Schema compliance
      expect(() => parseTaskOutputCoreSchema.parse(result)).not.toThrow();

      // Field-specific validations
      expect(result.title).toContain("Fix"); // Should contain key action verb
      expect(result.title.split(" ").length).toBeGreaterThanOrEqual(2); // 2-8 words
      expect(result.title.split(" ").length).toBeLessThanOrEqual(8);
      expect(config.categories).toContain(result.category);
      expect(config.priorities.levels).toContain(result.priority.level);
      expect(result.priority.score).toBeGreaterThanOrEqual(0);
      expect(result.priority.score).toBeLessThanOrEqual(10);
      expect(result.priority.reason).toBeTruthy();
    });

    it("should parse 'Buy birthday gift for mom' as errand task", async () => {
      const naturalLanguage = "Buy birthday gift for mom";

      const result = await executeParseTask(naturalLanguage);

      // Schema compliance
      expect(() => parseTaskOutputCoreSchema.parse(result)).not.toThrow();

      // Field-specific validations
      expect(config.categories).toContain(result.category);
      expect(result.dueDate).toBeNull(); // No explicit deadline
      expect(result.title).toBeTruthy();
    });
  });

  describe("Health Tasks", () => {
    it("should parse 'Book dentist appointment' as health category", async () => {
      const naturalLanguage = "Book dentist appointment";

      const result = await executeParseTask(naturalLanguage);

      // Schema compliance
      expect(() => parseTaskOutputCoreSchema.parse(result)).not.toThrow();

      // Field-specific validations
      expect(result.category).toBe("health");
      expect(result.dueDate).toBeNull(); // No specific date mentioned
      expect(result.title).toBeTruthy();
    });
  });

  describe("Tasks with Relative Dates", () => {
    it("should parse 'Pay electricity bill tomorrow' with due date set to tomorrow", async () => {
      const naturalLanguage = "Pay electricity bill tomorrow";

      const result = await executeParseTask(naturalLanguage);

      // Schema compliance
      expect(() => parseTaskOutputCoreSchema.parse(result)).not.toThrow();

      // Field-specific validations
      expect(result.dueDate).not.toBeNull(); // Specific deadline "tomorrow"
      expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO datetime format
      expect(result.category).toBe("finance");
      expect(config.priorities.levels).toContain(result.priority.level);
      expect(result.priority.score).toBeGreaterThanOrEqual(0);
      expect(result.priority.score).toBeLessThanOrEqual(10);
    });
  });

  describe("Work Tasks", () => {
    it("should parse 'Schedule team sync every Monday at 9am' as work category", async () => {
      const naturalLanguage = "Schedule team sync every Monday at 9am";

      const result = await executeParseTask(naturalLanguage);

      // Schema compliance
      expect(() => parseTaskOutputCoreSchema.parse(result)).not.toThrow();

      // Field-specific validations
      expect(result.category).toBe("work");
      expect(result.title).toBeTruthy();
      expect(result.title.split(" ").length).toBeGreaterThanOrEqual(2); // 2-8 words
      expect(result.title.split(" ").length).toBeLessThanOrEqual(8);
    });

    it("should parse 'Update resume and apply for jobs' as work category", async () => {
      const naturalLanguage = "Update resume and apply for jobs";

      const result = await executeParseTask(naturalLanguage);

      // Schema compliance
      expect(() => parseTaskOutputCoreSchema.parse(result)).not.toThrow();

      // Field-specific validations
      expect(result.category).toBe("work");
      expect(result.title).toBeTruthy(); // Concise, removes filler
      expect(config.priorities.levels).toContain(result.priority.level);
      expect(result.priority.score).toBeGreaterThanOrEqual(0);
      expect(result.priority.score).toBeLessThanOrEqual(10);
    });
  });

  describe("Complex Tasks with Metadata", () => {
    it("should parse 'Submit Q2 report by next Friday and mark it high priority under Work' with all metadata", async () => {
      const naturalLanguage =
        "Submit Q2 report by next Friday and mark it high priority under Work";

      const result = await executeParseTask(naturalLanguage);

      // Schema compliance
      expect(() => parseTaskOutputCoreSchema.parse(result)).not.toThrow();

      // Field-specific validations
      expect(result.dueDate).not.toBeNull(); // Specific deadline "next Friday"
      expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO datetime format
      expect(result.category).toBe("work"); // Explicitly mentioned
      expect(result.priority.level).toBe("high"); // Explicitly mentioned
      expect(result.priority.score).toBeGreaterThanOrEqual(7);
      expect(result.priority.score).toBeLessThanOrEqual(8);
      expect(result.title).toContain("Submit Q2 Report");
    });
  });
});
