import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  executeJudgeOutput,
  executeParseTask,
} from "@capabilities/parse-task/prompts/core/v1/evals/utils/execute-llm-calls";

const TEST_TIMEOUT = 15000;

const testCases = [
  "Plan something soon",
  "Fix broken laptop screen",
  "Buy birthday gift for mom",
  "Book dentist appointment",
  "Pay electricity bill tomorrow",
  "Schedule team sync every Monday at 9am",
  "Update resume and apply for jobs",
  "Submit Q2 report by next Friday and mark it high priority under Work",
] as const;

describe("corePromptV1 - Level2Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(testCases)(
    "should judge $naturalLanguage",
    async (naturalLanguage) => {
      const output = await executeParseTask(naturalLanguage);
      const judge = await executeJudgeOutput(naturalLanguage, output);

      console.log(`\n=== Judge for: "${naturalLanguage}" ===`);
      console.log(`Overall: ${judge.overallPass ? "✅ PASS" : "❌ FAIL"}`);

      if (judge.explanation) {
        console.log("Explanation:", judge.explanation);
      }

      if (
        judge.suggestedPromptImprovements &&
        judge.suggestedPromptImprovements.length > 0
      ) {
        console.log(`Prompt Improvements:`);
        judge.suggestedPromptImprovements.forEach((improvement, index) => {
          console.log(`${index + 1}. ${improvement}`);
        });
      }

      expect(judge.overallPass).toBe(true);
    },
    TEST_TIMEOUT
  );
});
