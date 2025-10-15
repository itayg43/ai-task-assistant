import { zodTextFormat } from "openai/helpers/zod";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { parseTaskOutputSchema } from "@capabilities/parse-task/parse-task-schemas";
import { ParseTaskConfig } from "@capabilities/parse-task/parse-task-types";
import { getDateISO } from "@shared/utils/date-time";

const BASE_INSTRUCTIONS = `
## Base Instructions
You are an assistant that converts natural language tasks into structured JSON.
`;

const generateParsingRules = (config: ParseTaskConfig) => {
  const {
    categories,
    priorities: { levels, scores, overallScoreRange },
  } = config;

  return `
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
${JSON.stringify(levels, null, 2)}
   - \`score\`: a number within ${overallScoreRange.min}–${
    overallScoreRange.max
  }, appropriate to the chosen level
   - \`reason\`: short explanation mentioning urgency and/or importance
2. Levels and numeric ranges: ${JSON.stringify(scores, null, 2)}
- Always pick a score inside the range of the chosen level.
- If a task is vague or low-impact, pick a score at the lower end of the level’s range.
- If a task is urgent/important, pick a score at the higher end of the level’s range.
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
    model: "gpt-4o-mini",
    instructions: prompt,
    input: naturalLanguage,
    temperature: 0,
    text: {
      format: zodTextFormat(parseTaskOutputSchema, "parseTaskOutputSchema"),
    },
  };
};
