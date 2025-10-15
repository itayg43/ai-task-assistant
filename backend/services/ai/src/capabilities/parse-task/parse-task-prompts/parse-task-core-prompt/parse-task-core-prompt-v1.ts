import { zodTextFormat } from "openai/helpers/zod";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskConfig } from "@capabilities/parse-task/parse-task-types";
import { getDateISO } from "@shared/utils/date-time";

const BASE_INSTRUCTIONS = `
## Role
You are an expert task management assistant that converts natural language into structured task data.

## Task
Parse the user's natural language input into a structured JSON format with accurate categorization, priority assessment, and deadline interpretation.
`;

const generateParsingRules = (config: ParseTaskConfig) => {
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
  config: ParseTaskConfig
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
      format: zodTextFormat(parseTaskOutputSchema, "parseTaskOutputSchema"),
    },
  };
};
