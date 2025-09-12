import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import {
  ParseTaskConfig,
  ParseTaskConfigPrioritiesScoreRange,
  ParseTaskConfigPrioritiesScores,
} from "@capabilities/parse-task/parse-task-types";
import { getDateISO } from "@shared/utils/date-time";

const INSTRUCTIONS = `
## Instructions
You are an assistant that converts natural language tasks into structured JSON.
Always respond with valid JSON only, no extra commentary.  
The JSON must follow this schema:  
{
  "title": string,
  "dueDate": string | null,
  "category": string,
  "priority": {
    "level": string,
    "score": number,
    "reason": string
  }
}
`;

const generateParsingRules = (
  categories: string[],
  priorityLevels: string[],
  priorityScores: ParseTaskConfigPrioritiesScores,
  priorityOverallScoreRange: ParseTaskConfigPrioritiesScoreRange
) => `
## Parsing Rules
**Title**
- Create a concise title that captures the core task
- Remove unnecessary words while preserving essential meaning
- Use proper capitalization and grammar
**Due Date**
- Use current date ${getDateISO()} as reference for relative dates
- Interpret "tomorrow", "next Friday", "this weekend", etc. correctly
- Return null if no date is mentioned or implied
**Category**
- Categories are dynamically defined as:
${JSON.stringify(categories, null, 2)}
- Select the most relevant category from this list only. Do not invent categories.
**Priority**
1. Each task priority must include:
   - \`level\`: one of the allowed dynamic levels:
${JSON.stringify(priorityLevels, null, 2)}
   - \`score\`: a number within ${priorityOverallScoreRange.min}–${
  priorityOverallScoreRange.max
}, appropriate to the chosen level
   - \`reason\`: short explanation mentioning urgency and/or importance
2. Levels and numeric ranges: ${JSON.stringify(priorityScores, null, 2)}
- Always pick a score inside the range of the chosen level.
- If a task is vague or low-impact, pick a score at the lower end of the level’s range.
- If a task is urgent/important, pick a score at the higher end of the level’s range.
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
  const { categories, priorities } = config;

  const prompt = `${INSTRUCTIONS}
                  ${generateParsingRules(
                    categories,
                    priorities.levels,
                    priorities.scores,
                    priorities.overallScoreRange
                  )}
                  ${INPUT}`;

  return {
    model: "gpt-4o-mini",
    instructions: prompt,
    input: naturalLanguage,
    temperature: 0,
  };
};
