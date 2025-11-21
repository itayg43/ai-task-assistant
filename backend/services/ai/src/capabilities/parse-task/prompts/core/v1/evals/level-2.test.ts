import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskInputConfig } from "@capabilities/parse-task/parse-task-mocks";
import { parseTaskOutputJudgeSchema } from "@capabilities/parse-task/parse-task-schemas";
import {
  ParseTaskInputConfig,
  ParseTaskOutputCore,
  ParseTaskOutputJudge,
} from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV1 } from "@capabilities/parse-task/prompts/core/v1";
import { executeParse } from "@clients/openai";
import { randomUUID } from "crypto";
import { zodTextFormat } from "openai/helpers/zod";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

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
    "parse-task",
    naturalLanguage,
    prompt,
    randomUUID()
  );
};

const createJudgePrompt = (
  naturalLanguage: string,
  output: ParseTaskOutputCore,
  config: ParseTaskInputConfig
): ResponseCreateParamsNonStreaming => {
  const prompt = `
  ## Role
  You are an expert AI evaluation judge that critiques task parsing outputs for quality and correctness.
  
  ## Task
  Evaluate the parse task output and provide a single pass/fail determination with detailed analysis and improvement suggestions.
  
  ## Context
  
  ### Input
  Natural Language: "${naturalLanguage}"
  
  ### Configuration
  Categories: ${config.categories.join(", ")}
  Priority Levels: ${config.priorities.levels.join(" | ")}
  Priority Score Ranges: ${Object.entries(config.priorities.scores)
    .map(([level, range]) => `${level}: ${range.min}-${range.max}`)
    .join(", ")}
  
  ### Generated Output
  Title: "${output.title}"
  Due Date: ${output.dueDate || null}
  Category: "${output.category}"
  Priority Level: "${output.priority.level}"
  Priority Score: ${output.priority.score}
  Priority Reason: "${output.priority.reason}"
  
  ## Evaluation Instructions
  
  ### Evaluation Criteria
  1. **Title Quality**: Concise, actionable, title case
  2. **Category Correctness**: Semantically matches task content
  3. **Priority Level**: Level appropriate for consequences/importance
  4. **Priority Score**: Consistent with level and reasoning
  5. **Priority Reason**: Clear, specific, well-justified
  
  ### Output Format
  - **overallPass**: boolean - true if the output meets all criteria, false otherwise
  - **explanation**: string | null - ONLY provide if overallPass is false. Concise failure explanation (2-3 sentences max) focusing on the most critical issues. Prioritize the most impactful problems and avoid repetitive analysis.
  - **suggestedPromptImprovements**: string[] | null - ONLY provide if overallPass is false. Max 3 prompt improvement suggestions.
  `;

  return {
    // Use a more powerful model for evaluation to ensure accurate assessment of the
    // cheaper model's output quality. If the mini model (gpt-4.1-mini) consistently
    // produces good results, we can confidently use it in production to optimize costs.
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
    "parse-task",
    naturalLanguage,
    prompt,
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

// System: ## Role
// You are an expert AI evaluation judge responsible for assessing the quality and correctness of task parsing outputs.

// ## Task
// Review the parsed task output and render a single pass/fail verdict, accompanied by detailed analysis and actionable improvement recommendations.

// Begin with a concise checklist (3-7 bullets) of the main evaluation steps; keep items conceptual.

// ## Context
// ### Input
// Natural Language: "Submit Q2 report by next Friday and mark it high priority under Work"

// ### Configuration
// - **Categories**: work, personal, health, finance, errand
// - **Priority Levels**: low | medium | high | critical
// - **Priority Score Ranges**:
//   - low: 0-3
//   - medium: 4-6
//   - high: 7-8
//   - critical: 9-10

// ### Generated Output
// - **Title**: "Submit Q2 Report"
// - **Due Date**: 2024-01-19T12:00:00.000Z
// - **Category**: "work"
// - **Priority Level**: "high"
// - **Priority Score**: 7
// - **Priority Reason**: "Deadline approaching next Friday with high importance for work reporting"

// ## Evaluation Instructions
// ### Evaluation Criteria
// 1. **Title Quality**: Should be concise, actionable, and use title case.
// 2. **Category Correctness**: Must semantically match the task content.
// 3. **Priority Level**: Should align with the task's consequences and importance.
// 4. **Priority Score**: Must be consistent with the assigned level and justification.
// 5. **Priority Reason**: Needs to be clear, specific, and well-justified.

// After your assessment and before rendering the final output, validate your verdict by checking that each criterion has been covered. If any are not fully addressed or conflicting, self-correct before finalizing.

// ### Output Format
// - **overallPass**: *boolean* — true if all criteria are satisfied; false otherwise.
// - **explanation**: *string | null* — Only provided if overallPass is false. Give a concise (2–3 sentences), focused explanation highlighting the most critical issues and avoid redundant analysis.
// - **suggestedPromptImprovements**: *string[] | null* — Only provided if overallPass is false. List up to three prompt improvement suggestions.

// User: Please evaluate the task parsing output.
