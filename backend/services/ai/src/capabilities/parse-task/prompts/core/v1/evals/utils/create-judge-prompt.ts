import { zodTextFormat } from "openai/helpers/zod";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import z from "zod";

import {
  ParseTaskInputConfig,
  ParseTaskOutputCore,
} from "@capabilities/parse-task/parse-task-types";

const judgeSchema = z.object({
  overallPass: z.boolean(),
  explanation: z.string().nullable(),
  suggestedPromptImprovements: z.array(z.string()).nullable(),
});

export type Judge = z.infer<typeof judgeSchema>;

export const createJudgePrompt = (
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
  - **explanation**: detailed failure explanation ONLY if overallPass is false.
  - **suggestedPromptImprovements**: max 3 prompt improvement suggestions ONLY if overallPass is false.
  `;

  return {
    model: "gpt-4.1",
    instructions: prompt,
    input: "Please evaluate the task parsing output.",
    temperature: 0,
    text: {
      format: zodTextFormat(judgeSchema, "judgeSchema"),
    },
  };
};
