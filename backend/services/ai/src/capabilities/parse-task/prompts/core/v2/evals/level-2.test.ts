import { randomUUID } from "crypto";
import { zodTextFormat } from "openai/helpers/zod";
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
  ParseTaskOutputCoreV2,
  ParseTaskOutputJudge,
} from "@capabilities/parse-task/parse-task-types";
import { parseTaskCorePromptV2 } from "@capabilities/parse-task/prompts/core/v2";
import { executeParse } from "@clients/openai";

import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

const TEST_TIMEOUT = 15000;

const JUDGE_OUTPUT_FORMAT_INSTRUCTIONS = `
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

const vagueInputTestCases = [
  { naturalLanguage: "Plan something soon" },
  { naturalLanguage: "Do stuff" },
  { naturalLanguage: "Fix it" },
  { naturalLanguage: "Update resume and apply for jobs" },
] as const;

const clearInputTestCases = [
  { naturalLanguage: "Fix broken laptop screen" },
  { naturalLanguage: "Buy birthday gift for mom" },
  { naturalLanguage: "Book dentist appointment" },
  { naturalLanguage: "Pay electricity bill tomorrow" },
  { naturalLanguage: "Schedule team sync every Monday at 9am" },
  {
    naturalLanguage:
      "Submit Q2 report by next Friday and mark it high priority under Work",
  },
] as const;

const logJudgeResult = (
  naturalLanguage: string,
  judgeOutput: ParseTaskOutputJudge,
  context?: string
) => {
  const prefix = context
    ? `Judge for ${context}: "${naturalLanguage}"`
    : `Judge for: "${naturalLanguage}"`;

  console.log(`\n=== ${prefix} ===`);
  console.log(`Overall: ${judgeOutput.overallPass ? "✅ PASS" : "❌ FAIL"}`);

  if (!judgeOutput.overallPass) {
    console.log("Explanation:", judgeOutput.explanation);

    console.log(`Suggested Prompt Improvements:`);
    judgeOutput.suggestedPromptImprovements?.forEach((improvement, index) => {
      console.log(`${index + 1}. ${improvement}`);
    });
  }
};

const createJudgeResponse = (
  instructions: string,
  input: string
): ResponseCreateParamsNonStreaming => {
  return {
    model: "gpt-4.1",
    instructions,
    input,
    temperature: 0,
    text: {
      format: zodTextFormat(
        parseTaskOutputJudgeSchema,
        "parseTaskOutputJudgeSchema"
      ),
    },
  };
};

const executeParseTask = async (naturalLanguage: string) => {
  const prompt = parseTaskCorePromptV2(
    naturalLanguage,
    mockParseTaskInputConfig
  );

  return await executeParse<ParseTaskOutputCoreV2>(
    PARSE_TASK_CAPABILITY,
    PARSE_TASK_CORE_OPERATION,
    naturalLanguage,
    prompt,
    "v2",
    randomUUID()
  );
};

const createJudgePromptForError = (
  naturalLanguage: string,
  output: ParseTaskOutputCoreV2,
  _config: ParseTaskInputConfig
): ResponseCreateParamsNonStreaming => {
  const prompt = `
## Role
You are an expert AI evaluation judge responsible for assessing the quality and correctness of task parsing error responses.

## Task
Review the error response for a vague input and render a single pass/fail verdict, accompanied by detailed analysis and actionable improvement recommendations.

Begin with a concise checklist (3-7 bullets) of the main evaluation steps; keep items conceptual.

## Context

### Input
Natural Language: "${naturalLanguage}"

### Generated Output (Error Response)
- **Success**: false
- **Error Reason**: "${output.error?.reason}"
- **Error Suggestions**: ${JSON.stringify(output.error?.suggestions)}

## Evaluation Instructions

### Evaluation Criteria
1. **Error Detection Correctness**: The input should genuinely be too vague to parse meaningfully.
2. **Reason Clarity**: The error reason should be concise, clear, and explain why the input is vague (1-2 sentences).
3. **Suggestions Quality**: 
   - Should provide 1-3 actionable suggestions
   - Each suggestion should be specific and helpful
   - Suggestions should guide the user to provide missing information

After your assessment and before rendering the final output, validate your verdict by checking that each criterion has been covered. If any are not fully addressed or conflicting, self-correct before finalizing.

${JUDGE_OUTPUT_FORMAT_INSTRUCTIONS}
`;

  return createJudgeResponse(
    prompt,
    "Please evaluate the error response for vague input."
  );
};

const createJudgePromptForSuccess = (
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

### Generated Output (Success Response)
- **Success**: true
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

${JUDGE_OUTPUT_FORMAT_INSTRUCTIONS}
`;

  return createJudgeResponse(
    prompt,
    "Please evaluate the task parsing output."
  );
};

const executeJudge = async (
  naturalLanguage: string,
  prompt: ResponseCreateParamsNonStreaming
) => {
  return await executeParse<ParseTaskOutputJudge>(
    PARSE_TASK_CAPABILITY,
    "judge",
    naturalLanguage,
    prompt,
    "v2",
    randomUUID()
  );
};

const executeJudgeOutputForError = async (
  naturalLanguage: string,
  output: ParseTaskOutputCoreV2
) => {
  const prompt = createJudgePromptForError(
    naturalLanguage,
    output,
    mockParseTaskInputConfig
  );

  return executeJudge(naturalLanguage, prompt);
};

const executeJudgeOutputForSuccess = async (
  naturalLanguage: string,
  output: ParseTaskOutputCore
) => {
  const prompt = createJudgePromptForSuccess(
    naturalLanguage,
    output,
    mockParseTaskInputConfig
  );

  return executeJudge(naturalLanguage, prompt);
};

describe("corePromptV2 - Level2Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("vague inputs - error response evaluation", () => {
    it.each(vagueInputTestCases)(
      "should judge error response for vague input: $naturalLanguage",
      async ({ naturalLanguage }) => {
        const { output: parseOutput } = await executeParseTask(naturalLanguage);

        expect(parseOutput.success).toBe(false);
        expect(parseOutput.error).not.toBeNull();

        const { output: judgeOutput } = await executeJudgeOutputForError(
          naturalLanguage,
          parseOutput
        );

        logJudgeResult(naturalLanguage, judgeOutput, "vague input");

        expect(judgeOutput.overallPass).toBe(true);
      },
      TEST_TIMEOUT
    );
  });

  describe("clear inputs - success response evaluation", () => {
    it.each(clearInputTestCases)(
      "should judge success response for: $naturalLanguage",
      async ({ naturalLanguage }) => {
        const { output: parseOutput } = await executeParseTask(naturalLanguage);

        expect(parseOutput.success).toBe(true);
        expect(parseOutput.task).not.toBeNull();

        const { output: judgeOutput } = await executeJudgeOutputForSuccess(
          naturalLanguage,
          parseOutput.task!
        );

        logJudgeResult(naturalLanguage, judgeOutput);

        expect(judgeOutput.overallPass).toBe(true);
      },
      TEST_TIMEOUT
    );
  });
});
