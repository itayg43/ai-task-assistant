import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  executeJudgeOutput,
  executeParseTask,
} from "@capabilities/parse-task/prompts/core/v1/evals/utils/execute-llm-calls";

const TEST_TIMEOUT = 15000;

const testCases = [
  { naturalLanguage: "Plan something soon" },
  { naturalLanguage: "Fix broken laptop screen" },
  { naturalLanguage: "Buy birthday gift for mom" },
  { naturalLanguage: "Book dentist appointment" },
  { naturalLanguage: "Pay electricity bill tomorrow" },
  { naturalLanguage: "Schedule team sync every Monday at 9am" },
  { naturalLanguage: "Update resume and apply for jobs" },
  {
    naturalLanguage:
      "Submit Q2 report by next Friday and mark it high priority under Work",
  },
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
    async ({ naturalLanguage }) => {
      const { output: parseOutput } = await executeParseTask(naturalLanguage);
      const { output: judgeOutput } = await executeJudgeOutput(
        naturalLanguage,
        parseOutput
      );

      console.log(`\n=== Judge for: "${naturalLanguage}" ===`);
      console.log(
        `Overall: ${judgeOutput.overallPass ? "✅ PASS" : "❌ FAIL"}`
      );

      if (judgeOutput.explanation) {
        console.log("Explanation:", judgeOutput.explanation);
      }

      if (
        judgeOutput.suggestedPromptImprovements &&
        judgeOutput.suggestedPromptImprovements.length > 0
      ) {
        console.log(`Prompt Improvements:`);
        judgeOutput.suggestedPromptImprovements.forEach(
          (improvement, index) => {
            console.log(`${index + 1}. ${improvement}`);
          }
        );
      }

      expect(judgeOutput.overallPass).toBe(true);
    },
    TEST_TIMEOUT
  );
});
