import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { ParseTaskConfig } from "@capabilities/parse-task/parse-task-types";
import { getDateISO } from "@shared/utils/date-time";

const ROLE = `
## Role
You are an expert task management assistant that parses natural language task descriptions into structured JSON data.
`;

const INSTRUCTIONS = `
## Instructions
Parse the natural language task description into structured JSON data following these strict requirements:
- Respond with ONLY a valid JSON object
- Do not include explanations, comments, or any other text
- Do not wrap the response in markdown or code block markers (\`\`\`)
- Ensure the JSON is properly formatted and parseable
- If any field cannot be determined, use null or appropriate default values
`;

const generateRequiredOutputFormat = (
  categories: string[],
  priorityLevels: string[]
) => `
## Required Output Format
You must respond with a JSON object in exactly this format:
{
  "title": "string - Clean, concise task title extracted from input",
  "dueDate": "ISO datetime string | null - Parsed due date or null if not specified",
  "category": "${categories.join(" | ")} - Must be one of these exact values",
  "priority": {
    "level": "${priorityLevels.join(
      " | "
    )} - Must be one of these exact values",
    "score": "number (0-100) - Numeric priority score",
    "reason": "string - Brief explanation for the priority assignment"
  }
}
`;

const generateParsingRules = (priorityLevels: string[]) => `
## Parsing Rules
Follow these rules when parsing the input:
**Title Extraction:**
- Create a clean, concise title that captures the core task
- Remove unnecessary words while preserving essential meaning
- Use proper capitalization and grammar
**Date Parsing:**
- Use current date ${getDateISO()} as reference for relative dates
- Interpret "tomorrow", "next Friday", "this weekend", etc. correctly
- Return null if no date is mentioned or implied
**Category Assignment:**
- Infer from context, keywords, or explicit mentions
- Default to most appropriate category based on task title if unclear
- Must be one of the allowed categories: ${priorityLevels.join(", ")}
**Priority Assessment:**
- level: Map urgency/importance cues to one of: "${priorityLevels.join(", ")}"
- score: Calculate 0-100 based on urgency, deadlines, language intensity, category context, and potential consequences
- reason: Provide a concise explanation of the priority assignment, including context and reasoning
`;

const INPUT = `
## Task to Parse
Parse this natural language task description:
"""
{naturalLanguage}
"""
`;

export const parseTaskCorePromptV1 = (
  naturalLanguage: string,
  config: ParseTaskConfig
): ResponseCreateParamsNonStreaming => {
  const { categories, priorityLevels } = config;

  const prompt = `${ROLE}
                  ${INSTRUCTIONS}
                  ${generateRequiredOutputFormat(categories, priorityLevels)}
                  ${generateParsingRules(priorityLevels)}
                  ${INPUT}`;

  return {
    model: "gpt-4o-mini",
    instructions: prompt,
    input: naturalLanguage,
    temperature: 0,
  };
};
