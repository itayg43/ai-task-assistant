import { randomUUID } from "crypto";
import { zodTextFormat } from "openai/helpers/zod";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PARSE_TASK_CAPABILITY,
  PARSE_TASK_CORE_OPERATION,
} from "@capabilities/parse-task/parse-task-constants";
import { mockParseTaskInputConfig } from "@capabilities/parse-task/parse-task-mocks";
import { parseTaskOutputJudgeSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInputConfig,
  ParseTaskOutputCore,
  ParseTaskOutputJudge,
} from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV1 } from "@capabilities/parse-task/prompts/core/v1";
import { executeParse } from "@clients/openai";

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

const executeParseTask = async (naturalLanguage: string) => {
  const prompt = parseTaskCorePromptV1(
    naturalLanguage,
    mockParseTaskInputConfig
  );

  return await executeParse<ParseTaskOutputCore>(
    PARSE_TASK_CAPABILITY,
    PARSE_TASK_CORE_OPERATION,
    naturalLanguage,
    prompt,
    "v1",
    randomUUID()
  );
};

const createJudgePrompt = (
  naturalLanguage: string,
  output: ParseTaskOutputCore,
  config: ParseTaskInputConfig
): ResponseCreateParamsNonStreaming => {
  const categoriesList = config.categories.join(", ");

  const priorityLevelsList = config.priorities.levels.join(" | ");

  const scoreRangesEntries = Object.entries(config.priorities.scores);

  const scoreRangesList = scoreRangesEntries
    .map(([level, range]) => `  - ${level}: ${range.min}-${range.max}`)
    .join("\n");

  const scoreRangesInline = scoreRangesEntries
    .map(([level, range]) => `${level}: ${range.min}-${range.max}`)
    .join(", ");

  const prompt = `
## Role
You are an expert AI evaluation judge responsible for assessing the quality and correctness of task parsing outputs.

## Task
Review the parsed task output and render a single pass/fail verdict, accompanied by detailed analysis and actionable improvement recommendations.

Begin with a concise checklist (3-7 bullets) of the main evaluation steps; keep items conceptual.

## Context

### Input
Natural Language: "${naturalLanguage}"

### Configuration
- **Categories**: ${categoriesList}
- **Priority Levels**: ${priorityLevelsList}
- **Priority Score Ranges**:
${scoreRangesList}

### Generated Output
- **Title**: "${output.title}"
- **Due Date**: ${output.dueDate || null}
- **Category**: "${output.category}"
- **Priority Level**: "${output.priority.level}"
- **Priority Score**: ${output.priority.score}
- **Priority Reason**: "${output.priority.reason}"

## Evaluation Instructions

### Evaluation Criteria
1. **Title Quality**: Should be concise, actionable, and use title case.
2. **Category Correctness**: Must semantically match the task content and be one of the valid categories: ${categoriesList}.
3. **Priority Level**: Should align with the task's consequences and importance, and must be one of: ${priorityLevelsList}.
4. **Priority Score**: Must be consistent with the assigned level and justification, and must fall within the score range for the selected level (${scoreRangesInline}).
5. **Priority Reason**: Needs to be clear, specific, and well-justified.

After your assessment and before rendering the final output, validate your verdict by checking that each criterion has been covered. If any are not fully addressed or conflicting, self-correct before finalizing.

### Output Format
The output must follow one of two structures based on the evaluation result:

**If overallPass is true:**
- **overallPass**: true
- **explanation**: null (must be explicitly set to null)
- **suggestedPromptImprovements**: null (must be explicitly set to null)

**If overallPass is false:**
- **overallPass**: false
- **explanation**: string (REQUIRED) - Concise failure explanation (2-3 sentences max) focusing on the most critical issues. Prioritize the most impactful problems and avoid repetitive analysis.
- **suggestedPromptImprovements**: string[] (REQUIRED) - Array of 1-3 prompt improvement suggestions. Must contain at least 1 and at most 3 items.
`;

  return {
    model: "gpt-4.1",
    instructions: prompt,
    input: "Please evaluate the task parsing output.",
    temperature: 0,
    text: {
      format: zodTextFormat(
        parseTaskOutputJudgeSchema,
        "parseTaskOutputJudgeSchema"
      ),
    },
  };
};

const executeJudgeOutput = async (
  naturalLanguage: string,
  output: ParseTaskOutputCore
) => {
  const prompt = createJudgePrompt(
    naturalLanguage,
    output,
    mockParseTaskInputConfig
  );

  return await executeParse<ParseTaskOutputJudge>(
    PARSE_TASK_CAPABILITY,
    "judge",
    naturalLanguage,
    prompt,
    "v1",
    randomUUID()
  );
};

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

      if (!judgeOutput.overallPass) {
        console.log("Explanation:", judgeOutput.explanation);

        console.log(`Suggested Prompt Improvements:`);
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
