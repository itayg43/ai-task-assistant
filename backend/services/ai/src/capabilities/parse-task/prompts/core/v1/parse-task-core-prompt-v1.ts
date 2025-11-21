import { zodTextFormat } from "openai/helpers/zod";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { parseTaskOutputCoreSchema } from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskInputConfig } from "@capabilities/parse-task/parse-task-types";
import { getDateISO } from "@shared/utils/date-time";

const BASE_INSTRUCTIONS = `
## Role
You are an expert task management assistant that converts natural language into structured task data.

## Task
Parse the user's natural language input into a structured JSON format with accurate categorization, priority assessment, and deadline interpretation.
`;

const generateParsingRules = (config: ParseTaskInputConfig) => {
  const {
    categories,
    priorities: { levels, scores, overallScoreRange },
  } = config;

  return `
## Output Format Rules

### Title
- Extract core task essence in 2-8 words
- Use title case, remove filler words
- Preserve key action verbs

### Due Date  
- Use current date ${getDateISO()} as reference
- Set dueDate when a specific deadline is explicitly mentioned or clearly implied
- Parse relative dates: "tomorrow" → next day, "next Friday" → specific date
- Vague terms like "soon", "eventually", "sometime" should result in null
- Return ISO datetime string or null if no deadline mentioned

### Category
- Must match exactly one from: ${categories.join(", ")}
- Choose most semantically relevant category
- Default to first category if ambiguous

### Priority
- Consider the context, nature of the task, and consequences of not completing it or completing it late
- Match the priority level to the severity of consequences and importance, not just urgency
- For vague, non-urgent tasks (e.g., "plan something soon"), use the lowest priority level available
- Level: ${levels.join(" | ")}
- Score: ${overallScoreRange.min}-${
    overallScoreRange.max
  } (within level's range)
- Reason: Brief explanation (urgency + importance)
- Score ranges: ${Object.entries(scores)
    .map(([level, range]) => `${level}: ${range.min}-${range.max}`)
    .join(", ")}
`;
};

export const parseTaskCorePromptV1 = (
  naturalLanguage: string,
  config: ParseTaskInputConfig
): ResponseCreateParamsNonStreaming => {
  const prompt = `${BASE_INSTRUCTIONS}
                  ${generateParsingRules(config)}
                `;

  return {
    model: "gpt-4.1-mini",
    instructions: prompt,
    input: naturalLanguage,
    temperature: 0,
    text: {
      format: zodTextFormat(
        parseTaskOutputCoreSchema,
        "parseTaskOutputCoreSchema"
      ),
    },
  };
};

// System: ## Role and Objective
// You are an expert task management assistant dedicated to transforming natural language user input into structured task data.

// ## Instructions
// - Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.
// - Parse the user's input into a structured JSON format with:
//   - Accurate task title extraction
//   - Precise category selection
//   - Detailed priority assessment (with scoring)
//   - Thorough deadline interpretation

// ### Output Format
// - Output a JSON object containing: title, dueDate, category, priority (level, score, reason).

// #### Title
// - Capture the essence of the task in 2-8 words.
// - Use title case and eliminate filler words.
// - Preserve important action verbs.

// #### Due Date
// - Use current UTC reference time: 2025-11-13T15:42:35.926Z.
// - Assign dueDate only if a specific deadline is stated or unambiguously implied.
// - Translate relative phrases (e.g., "tomorrow" = next calendar day; "next Friday" = next occurrence of Friday from reference date) into ISO datetime string.
// - Treat vague terms (e.g., "soon", "eventually", "sometime") as no due date (null).
// - Set dueDate to ISO format string or null if not applicable.

// #### Category
// - Assign exactly one category from: work, personal, health, finance, errand.
// - Select the most semantically appropriate category.
// - If uncertain, default to the first category (work).

// #### Priority
// - Assess based on task context, inherent importance, and the result of delayed or uncompleted execution.
// - Prioritize not only urgency but also consequence and value.
// - Assign the lowest priority for ambiguous, non-urgent tasks (e.g., "plan something soon").
// - Return priority as:
//   - level: one of [low, medium, high, critical]
//   - score: integer within level bounds (low: 0-3, medium: 4-6, high: 7-8, critical: 9-10)
//   - reason: concise justification focusing on urgency and importance

// After producing the JSON output, briefly validate that each field is appropriately filled according to the instructions, and state if any assumptions were required.

// User: Submit Q2 report by next Friday and mark it high priority under Work
