export const parseTaskPrompt = (
  priorities: readonly string[],
  categories: readonly string[],
  frequencies: readonly string[]
) => `
## Instructions
Parse the natural language task description into structured JSON data.

Respond with only a valid JSON object. Do not include explanations or any other text. Do not wrap the response in markdown or code block markers (\`\`\`). Do not include comments.

⚠️ This prompt is designed to be used with OpenAI's API using temperature = 0 to ensure deterministic and consistent output.

## Output Format
Return only a single JSON object with the following structure:

{
  "title": "Task title",
  "dueDate": "ISO datetime string or null",
  "priority": "${priorities.join(" | ")}",
  "category": "${categories.join(" | ")}",
  "recurrence": {
    "frequency": "${frequencies.join(" | ")}",
    "interval": 1,
    "dayOfWeek": number (0 = Sunday, 6 = Saturday) or null,
    "dayOfMonth": number (1–31) or null,
    "endDate": "ISO datetime string or null"
  } or null,
  "subtasks": ["subtask1", "subtask2"] or null
}

## Parsing Rules
- Parse dates: "tomorrow" → today's date, "next Friday" → next Friday's date
- Priority: "urgent" / "high priority" → "high", "low priority" → "low", default → "medium"
- Category: infer from context or explicit mentions, otherwise default based on task title keywords
- Recurrence:
  - "every Monday" → weekly, "daily" → daily, "monthly" → monthly
  - Use \`dayOfWeek\` for weekly recurrence (0 = Sunday to 6 = Saturday), otherwise null
  - Use \`dayOfMonth\` for monthly recurrence (1–31), otherwise null
- Subtasks: suggest logical steps if the task is complex or multi-step
- Default priority: "medium" if not specified
- Default category: infer based on task title if not specified

## Examples

### Example 1
Input:
"""
Submit Q2 report by next Friday and mark it high priority under Work
"""
Output:
{
  "title": "Submit Q2 report",
  "dueDate": "2024-01-19T23:59:59Z",
  "priority": "high",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Gather Q2 data", "Create report draft", "Review with team", "Submit final report"]
}

### Example 2
Input:
"""
Schedule team sync every Monday at 9am
"""
Output:
{
  "title": "Schedule team sync",
  "dueDate": "2024-01-15T09:00:00Z",
  "priority": "medium",
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

### Example 3
Input:
"""
Pay electricity bill tomorrow
"""
Output:
{
  "title": "Pay electricity bill",
  "dueDate": "2024-01-16T23:59:59Z",
  "priority": "medium",
  "category": "finance",
  "recurrence": null,
  "subtasks": ["Check bill amount", "Log into payment portal", "Confirm payment"]
}

### Example 4 (Ambiguous Input)
Input:
"""
Plan something soon
"""
Output:
{
  "title": "Plan something",
  "dueDate": null,
  "priority": "medium",
  "category": "personal",
  "recurrence": null,
  "subtasks": null
}

### Example 5 (No Date)
Input:
"""
Check project progress
"""
Output:
{
  "title": "Check project progress",
  "dueDate": null,
  "priority": "medium",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Review current status", "Update stakeholders", "Document findings"]
}

## Input to Parse
"""
{naturalLanguage}
"""
`;
