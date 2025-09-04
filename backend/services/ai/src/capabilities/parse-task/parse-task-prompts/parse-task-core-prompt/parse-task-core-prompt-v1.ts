import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { ParsedTaskConfig } from "@capabilities/parse-task/parse-task-types";
import { getDateISO } from "@shared/utils/date-time";

const BASE_INSTRUCTIONS = `
## Instructions
Parse the natural language task description into structured JSON data.
Respond with only a valid JSON object. Do not include explanations or any other text.
Do not wrap the response in markdown or code block markers (\`\`\`).
Do not include comments.
`;

const generateOutputFormat = (
  categories: string[],
  priorityLevels: string[]
) => `
## Output Format
{
  "title": "string",
  "dueDate": "ISO datetime string" | null,
  "category": "${categories.join(" | ")}",
  "priority": {
    "level": "${priorityLevels.join(" | ")}",
    "score": number (0-100),
    "reason": "string"
  }
}
`;

const generateParsingRules = (priorityLevels: string[]) => `
## Parsing Rules
- dueDate: use current date ${getDateISO()} to interpret "tomorrow", "next Friday", "this weekend", etc correctly.
- category: infer from context or explicit mentions, otherwise default based on task title.
- priority:
  - level: map urgency/importance cues to a level: "${priorityLevels.join(
    ", "
  )}"
  - score: score priority from 0-100 based on urgency, deadlines, language, category context and consequences.
  - reason: include a short natural-language reason explaining the priority score and level, including category context and consequences.
`;

const INPUT = `
## Input to Parse
"""
{naturalLanguage}
"""
`;

export const parseTaskCorePromptV1 = (
  naturalLanguage: string,
  config: ParsedTaskConfig
): ResponseCreateParamsNonStreaming => {
  const { categories, priorityLevels } = config;

  const prompt = `${BASE_INSTRUCTIONS}
                  ${generateOutputFormat(categories, priorityLevels)}
                  ${generateParsingRules(priorityLevels)}
                  ${INPUT}`;

  return {
    model: "gpt-4o-mini",
    instructions: prompt,
    input: naturalLanguage,
    temperature: 0,
  };
};
