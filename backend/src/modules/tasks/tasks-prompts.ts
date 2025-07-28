import {
  EMOTIONAL_LANGUAGE,
  PRIORITY_SCORE,
} from "@modules/tasks/tasks-constants";

export const parseTaskPrompt = (
  priorities: readonly string[],
  prioritiesScores: typeof PRIORITY_SCORE,
  categories: readonly string[],
  frequencies: readonly string[],
  emotionalLanguage: typeof EMOTIONAL_LANGUAGE
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
  "priorityLevel": "${priorities.join(" | ")}",
  "priorityScore": number (0–100),
  "priorityReason": "Explanation of the priority score and level",
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
- Priority:
  - Map urgency/importance cues to a level: "${priorities.join(", ")}"
  - Score priority from 0–100 based on urgency, deadlines, and language:
    - ${prioritiesScores.CRITICAL.keywords.join(", ")} → ${
  prioritiesScores.CRITICAL.min
}–${prioritiesScores.CRITICAL.max}
    - ${prioritiesScores.HIGH.keywords.join(", ")} → ${
  prioritiesScores.HIGH.min
}–${prioritiesScores.HIGH.max}
    - ${prioritiesScores.MEDIUM.keywords.join(", ")} → ${
  prioritiesScores.MEDIUM.min
}–${prioritiesScores.MEDIUM.max}
    - ${prioritiesScores.LOW.keywords.join(", ")} → ${
  prioritiesScores.LOW.min
}–${prioritiesScores.LOW.max}
  - For conflicting indicators, consider context:
    - Deadline + priority word → prioritize the more urgent one
    - Emotional language (${emotionalLanguage.INCREASE.join(
      ", "
    )}) increases priority
    - Vague language (${emotionalLanguage.DECREASE.join(
      ", "
    )}) decreases priority
- Include a short natural-language reason explaining the priority
- Category: infer from context or explicit mentions, otherwise default based on task title keywords
- Recurrence:
  - "every Monday" → weekly, "daily" → daily, "monthly" → monthly
  - Use \`dayOfWeek\` for weekly recurrence (0 = Sunday to 6 = Saturday), otherwise null
  - Use \`dayOfMonth\` for monthly recurrence (1–31), otherwise null
- Subtasks: suggest logical steps if the task is complex or multi-step
- Default priorityLevel: If no urgency or importance is detected, default to priorityLevel: "medium" and priorityScore: 50.
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
  "priorityLevel": "high",
  "priorityScore": 88,
  "priorityReason": "Marked as high priority with a clear deadline next Friday.",
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

### Example 3
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

### Example 4 (Ambiguous Input)
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

### Example 5 (No Date)
Input:
"""
Check project progress
"""
Output:
{
  "title": "Check project progress",
  "dueDate": null,
  "priorityLevel": "medium",
  "priorityScore": 55,
  "priorityReason": "Important to maintain awareness, but no explicit urgency.",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Review current status", "Update stakeholders", "Document findings"]
}

### Example 6 (Conflicting Priority Indicators)
Input:
"""
Low priority task but it's due tomorrow
"""
Output:
{
  "title": "Low priority task",
  "dueDate": "2024-01-16T23:59:59Z",
  "priorityLevel": "high",
  "priorityScore": 85,
  "priorityReason": "Despite being marked as low priority, the tomorrow deadline makes it urgent.",
  "category": "personal",
  "recurrence": null,
  "subtasks": null
}

### Example 7 (Emotional Language)
Input:
"""
I really need to call my mom this week
"""
Output:
{
  "title": "Call mom",
  "dueDate": "2024-01-21T23:59:59Z",
  "priorityLevel": "high",
  "priorityScore": 75,
  "priorityReason": "Emotional urgency indicated by 'really need' with a weekly timeframe.",
  "category": "personal",
  "recurrence": null,
  "subtasks": null
}

### Example 8 (Multiple Deadlines)
Input:
"""
Submit proposal by Friday, final version by Monday
"""
Output:
{
  "title": "Submit proposal",
  "dueDate": "2024-01-19T23:59:59Z",
  "priorityLevel": "critical",
  "priorityScore": 92,
  "priorityReason": "Multiple deadlines indicate high importance, with Friday being the primary deadline.",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Create initial draft", "Review and revise", "Submit by Friday", "Prepare final version for Monday"]
}

### Example 9 (URGENT with Exclamation)
Input:
"""
URGENT: Server down, fix immediately!
"""
Output:
{
  "title": "Fix server",
  "dueDate": null,
  "priorityLevel": "critical",
  "priorityScore": 98,
  "priorityReason": "URGENT keyword with exclamation and immediate timeframe indicates critical priority.",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Identify the issue", "Implement fix", "Test functionality", "Monitor system"]
}

### Example 10 (Vague with Emotional Language)
Input:
"""
I should probably organize my desk when I have time
"""
Output:
{
  "title": "Organize desk",
  "dueDate": null,
  "priorityLevel": "low",
  "priorityScore": 20,
  "priorityReason": "Vague timeframe ('when I have time') and optional language ('should probably') indicates low priority.",
  "category": "personal",
  "recurrence": null,
  "subtasks": null
}

### Example 11 (High Priority Without Deadline)
Input:
"""
High priority: Review security protocols
"""
Output:
{
  "title": "Review security protocols",
  "dueDate": null,
  "priorityLevel": "high",
  "priorityScore": 80,
  "priorityReason": "Explicitly marked as high priority despite no specific deadline.",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Audit current protocols", "Identify vulnerabilities", "Update documentation", "Train team"]
}

### Example 12 (Emotional + Deadline Conflict)
Input:
"""
I desperately need to finish this project by next month
"""
Output:
{
  "title": "Finish project",
  "dueDate": "2024-02-15T23:59:59Z",
  "priorityLevel": "high",
  "priorityScore": 85,
  "priorityReason": "Emotional urgency ('desperately') combined with specific deadline increases priority.",
  "category": "work",
  "recurrence": null,
  "subtasks": ["Review project scope", "Create timeline", "Allocate resources", "Execute plan"]
}

## Input to Parse
"""
{naturalLanguage}
"""
`;
