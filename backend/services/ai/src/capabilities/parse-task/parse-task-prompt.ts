import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import {
  CATEGORY,
  EMOTIONAL_LANGUAGE,
  FREQUENCY,
  PRIORITY_LEVEL,
  PRIORITY_SCORE,
} from "@capabilities/parse-task/parse-task-constants";

export const parseTaskPrompt = (
  naturalLanguage: string
): ResponseCreateParamsNonStreaming => {
  const prompt = `
## Instructions
Parse the natural language task description into structured JSON data.
**Current Date Context**: Today is ${
    new Date().toISOString().split("T")[0]
  } (YYYY-MM-DD). Use this context to parse relative dates like "tomorrow", "next Thursday", "this weekend", etc.
Respond with only a valid JSON object. Do not include explanations or any other text. Do not wrap the response in markdown or code block markers (\`\`\`). Do not include comments.
⚠️ This prompt is designed to be used with OpenAI's API using temperature = 0 to ensure deterministic and consistent output.
## Output Format
Return only a single JSON object with the following structure:
{
  "title": "Task title",
  "dueDate": "ISO datetime string or null",
  "priorityLevel": "${PRIORITY_LEVEL.join(" | ")}",
  "priorityScore": number (0–100),
  "priorityReason": "Explanation of the priority score and level",
  "category": "${CATEGORY.join(" | ")}",
  "recurrence": {
    "frequency": "${FREQUENCY.join(" | ")}",
    "interval": 1,
    "dayOfWeek": number (0 = Sunday, 6 = Saturday) or null,
    "dayOfMonth": number (1–31) or null,
    "endDate": "ISO datetime string or null"
  } or null,
  "subtasks": ["subtask1", "subtask2"] or null
}
## Parsing Rules
- Parse dates: Use current date context to interpret "tomorrow", "next Friday", "this weekend", etc.
- Priority:
  - Map urgency/importance cues to a level: "${PRIORITY_LEVEL.join(", ")}"
  - Score priority from 0–100 based on urgency, deadlines, language, AND category context:
    - ${PRIORITY_SCORE.CRITICAL.keywords.join(", ")} → ${
    PRIORITY_SCORE.CRITICAL.min
  }–${PRIORITY_SCORE.CRITICAL.max}
    - ${PRIORITY_SCORE.HIGH.keywords.join(", ")} → ${PRIORITY_SCORE.HIGH.min}–${
    PRIORITY_SCORE.HIGH.max
  }
    - ${PRIORITY_SCORE.MEDIUM.keywords.join(", ")} → ${
    PRIORITY_SCORE.MEDIUM.min
  }–${PRIORITY_SCORE.MEDIUM.max}
    - ${PRIORITY_SCORE.LOW.keywords.join(", ")} → ${PRIORITY_SCORE.LOW.min}–${
    PRIORITY_SCORE.LOW.max
  }
  - Consider category importance in scoring:
    - Health tasks: Consider preventive care importance and long-term well-being impact
    - Personal tasks: Consider emotional significance and relationship impact
    - Financial tasks: Consider consequences (late fees, credit impact, financial security)
    - Work tasks: Consider professional impact, deadlines, and career implications
    - Errands: Consider convenience, routine importance, and daily life impact
  - For conflicting indicators, consider context and category importance
  - Emotional language (${EMOTIONAL_LANGUAGE.INCREASE.join(
    ", "
  )}) increases priority
  - Vague language (${EMOTIONAL_LANGUAGE.DECREASE.join(
    ", "
  )}) decreases priority
- Include a short natural-language reason explaining the priority, including category context when relevant
- Category: infer from context or explicit mentions, otherwise default based on task title keywords
- Recurrence:
  - "every Monday" → weekly, "daily" → daily, "monthly" → monthly
  - Use \`dayOfWeek\` for weekly recurrence (0 = Sunday to 6 = Saturday), otherwise null
  - Use \`dayOfMonth\` for monthly recurrence (1–31), otherwise null
- Subtasks: suggest logical steps if the task is complex or multi-step
- Default priorityLevel: "medium", priorityScore: 50
- Default category: infer based on task title if not specified
## Examples
### Example 1 (Basic Task with Deadline)
Input:
"""
Submit Q2 report by next Friday and mark it high priority under Work
"""
Output:
{
  "title": "Submit Q2 report",
  "dueDate": "2024-01-19T23:59:59Z",
  "priorityLevel": "high",
  "priorityScore": 88,
  "priorityReason": "Marked as high priority with a clear deadline next Friday.",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Gather Q2 data", "Create report draft", "Review with team", "Submit final report"]
}
### Example 2 (Recurring Task)
Input:
"""
Schedule team sync every Monday at 9am
"""
Output:
{
  "title": "Schedule team sync",
  "dueDate": "2024-01-15T09:00:00Z",
  "priorityLevel": "medium",
  "priorityScore": 60,
  "priorityReason": "Recurring meetings are important for coordination but not urgent.",
  "category": "work",
  "recurrence": {
    "frequency": "weekly",
    "interval": 1,
    "dayOfWeek": 1,
    "dayOfMonth": null,
    "endDate": null
  },
  "subtasks": ["Send calendar invite", "Prepare agenda", "Send reminder"]
}
### Example 3 (Financial Deadline)
Input:
"""
Pay electricity bill tomorrow
"""
Output:
{
  "title": "Pay electricity bill",
  "dueDate": "2024-01-16T23:59:59Z",
  "priorityLevel": "critical",
  "priorityScore": 95,
  "priorityReason": "Includes a hard deadline (tomorrow) and essential consequence if missed.",
  "category": "finance",
  "recurrence": null,
  "subtasks": ["Check bill amount", "Log into payment portal", "Confirm payment"]
}
### Example 4 (Health Task - Higher Score)
Input:
"""
Book dentist appointment
"""
Output:
{
  "title": "Book dentist appointment",
  "dueDate": null,
  "priorityLevel": "medium",
  "priorityScore": 65,
  "priorityReason": "Health-related task with importance for preventive care and long-term well-being.",
  "category": "health",
  "recurrence": null,
  "subtasks": ["Find a dentist", "Check availability", "Schedule appointment"]
}
### Example 5 (Relationship Task - Higher Score)
Input:
"""
Buy birthday gift for mom
"""
Output:
{
  "title": "Buy birthday gift for mom",
  "dueDate": null,
  "priorityLevel": "medium",
  "priorityScore": 60,
  "priorityReason": "Personal relationship task with emotional significance and family importance.",
  "category": "personal",
  "recurrence": null,
  "subtasks": ["Decide on a gift", "Check budget", "Purchase gift"]
}
### Example 6 (Career Development - High Priority)
Input:
"""
Update resume and apply for jobs
"""
Output:
{
  "title": "Update resume and apply for jobs",
  "dueDate": null,
  "priorityLevel": "high",
  "priorityScore": 82,
  "priorityReason": "Career development task with high importance for professional advancement and future opportunities.",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Revise resume content", "Tailor resume for specific jobs", "Research job openings", "Submit applications"]
}
### Example 7 (Equipment Failure - High Priority)
Input:
"""
Fix broken laptop screen
"""
Output:
{
  "title": "Fix broken laptop screen",
  "dueDate": null,
  "priorityLevel": "high",
  "priorityScore": 85,
  "priorityReason": "Critical equipment failure affecting work productivity and daily functionality.",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Assess damage", "Research repair options", "Schedule repair appointment", "Backup data"]
}
### Example 8 (Vague Task - Low Priority)
Input:
"""
Plan something soon
"""
Output:
{
  "title": "Plan something",
  "dueDate": null,
  "priorityLevel": "low",
  "priorityScore": 25,
  "priorityReason": "Vague and no specific timeframe; not urgent or important.",
  "category": "personal",
  "recurrence": null,
  "subtasks": null
}
## Input to Parse
"""
{naturalLanguage}
"""
`;

  return {
    model: "gpt-4o-mini",
    instructions: prompt,
    input: naturalLanguage,
    temperature: 0,
  };
};
