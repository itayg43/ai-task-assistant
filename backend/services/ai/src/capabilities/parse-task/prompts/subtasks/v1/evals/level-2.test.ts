import { randomUUID } from "crypto";
import { zodTextFormat } from "openai/helpers/zod";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PARSE_TASK_CAPABILITY,
  PARSE_TASK_SUBTASKS_OPERATION,
} from "@capabilities/parse-task/parse-task-constants";
import { parseTaskOutputJudgeSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskOutputJudge,
  ParseTaskOutputSubtasks,
} from "@capabilities/parse-task/parse-task-types";
import { parseTaskSubtasksPromptV1 } from "@capabilities/parse-task/prompts/subtasks/v1";
import { executeParse } from "@clients/openai";

const TEST_TIMEOUT = 15000;

const testCases = [
  { naturalLanguage: "Plan vacation" },
  { naturalLanguage: "Update resume and apply for jobs" },
  { naturalLanguage: "Buy groceries" },
  { naturalLanguage: "Fix broken laptop screen" },
  { naturalLanguage: "Prepare for meeting" },
  { naturalLanguage: "Submit Q2 report by next Friday" },
  { naturalLanguage: "Organize party" },
  {
    naturalLanguage:
      "Plan and execute a company-wide team building event for 50 people next month with budget approval, venue booking, and activity coordination",
  },
  {
    naturalLanguage:
      "Coordinate a product launch event including marketing campaign, logistics planning, stakeholder presentations, and customer feedback collection",
  },
  {
    naturalLanguage:
      "Prepare comprehensive quarterly business review with financial analysis, team performance metrics, strategic recommendations, and board presentation materials",
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

const createJudgePrompt = (
  naturalLanguage: string,
  output: ParseTaskOutputSubtasks
): ResponseCreateParamsNonStreaming => {
  const subtasks = output.subtasks;
  const subtasksDisplay = subtasks
    ? subtasks
        .map((subtask: string, index: number) => `  ${index + 1}. "${subtask}"`)
        .join("\n")
    : "null";

  const prompt = `
## Role
You serve as an expert AI evaluation judge responsible for assessing the quality and correctness of subtask extraction outputs.

## Task
Review the provided extracted subtasks and deliver a single pass/fail verdict, along with a detailed analysis and actionable improvement recommendations.
Begin your review with a concise checklist (3-7 bullets) covering the main evaluation steps; keep checklist items conceptual.

## Context

### Input
- Natural Language: "${naturalLanguage}"

### Generated Output
- Subtasks: ${subtasks ? `\n${subtasksDisplay}` : "null"}

## Evaluation Instructions

### Evaluation Criteria
1. **Subtasks Count:** Output should include 3-7 subtasks, or return \`null\` if no appropriate subtasks are found in the input.
2. **Subtasks Quality:** Each subtask must be concise (2-8 words), actionable, and use title case.
3. **Subtasks Relevance:** Subtasks should represent genuine work steps required to complete the given task, not parsing or metadata.
4. **Subtasks Distinctness:** Each subtask must be a distinct, non-overlapping work item.
5. **Work Steps Focus:** Subtasks must reflect actual work, avoiding metadata (priority, category, due date) or linguistic breakdowns.
6. **Null Handling:** Only use \`null\` for tasks that are truly atomic and cannot be decomposed into meaningful work steps.

### When to Return Null
- Task is atomic and cannot be broken down further (e.g., "Buy groceries", "Fix broken laptop screen").
- Task is already at the lowest actionable level.
- Breaking down the task would not add value.

### When to Return Subtasks
- The task can be reasonably split into distinct work steps (e.g., "Submit Q2 report" → gather data, write, review, submit).
- Input explicitly lists multiple actions (e.g., "Plan vacation: book flights, reserve hotel").
- Input presents a compound task that can be decomposed (e.g., "Update resume and apply for jobs").
- The main verb in the task suggests multiple steps are needed to complete it.

### What Subtasks Should Be
- Actual work steps required to complete the task.
- Distinct, actionable work items.
- Presented in a logical sequence (e.g., gather → write → review → submit).

### What Subtasks Should NOT Be
- Metadata such as priority, category, or due date.
- Parsing or referencing sentence structure.
- Merely restating the main task.

After conducting your evaluation, validate your verdict by ensuring every criterion has been addressed. Self-correct if any criterion is missed or if there are conflicts, prior to producing your final output.

### Output Format
Use one of the following structures for your output, based on the evaluation result:
**If overallPass is true:**
- \`overallPass\`: true
- \`explanation\`: null
- \`suggestedPromptImprovements\`: null

**If overallPass is false:**
- \`overallPass\`: false
- \`explanation\`: string (Concise, 2-3 sentences highlighting the main issues. Focus on the most critical problems, avoid repetition.)
- \`suggestedPromptImprovements\`: string[] (Provide 1-3 actionable suggestions for improving the prompt.)

### Output Verbosity
- Your review should not exceed 2 short paragraphs for explanations, and bullet lists should be capped at 7 items, with 1 line per item. Prioritize complete, actionable answers within these length limits.
`;

  return {
    model: "gpt-4.1",
    instructions: prompt,
    input: "Please evaluate the subtasks extraction output.",
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
  output: ParseTaskOutputSubtasks
) => {
  const prompt = createJudgePrompt(naturalLanguage, output);

  return await executeParse<ParseTaskOutputJudge>(
    PARSE_TASK_CAPABILITY,
    "judge",
    naturalLanguage,
    prompt,
    "v1",
    randomUUID()
  );
};

describe("subtasksPromptV1 - Level2Tests", () => {
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
      const { output: parseOutput } = await executeParseSubtasks(
        naturalLanguage
      );
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
