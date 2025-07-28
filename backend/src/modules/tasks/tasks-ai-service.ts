import { openai } from "@clients/openai";
import { createLogger } from "@config/logger";
import { CATEGORY, FREQUENCY, PRIORITY } from "@modules/tasks/tasks-constants";
import { parseTaskPrompt } from "@modules/tasks/tasks-prompts";
import { createTaskAiResponseSchema } from "@modules/tasks/tasks-schemas";

const logger = createLogger("tasksAiService");

export const parseTask = async (naturalLanguage: string) => {
  const prompt = parseTaskPrompt(PRIORITY, CATEGORY, FREQUENCY);

  const aiResponse = await openai.responses.create({
    model: "gpt-4o-mini",
    instructions: prompt,
    input: naturalLanguage,
    temperature: 0,
  });
  const parsedAiResponse = JSON.parse(aiResponse.output_text);
  const validatedAiResponse =
    createTaskAiResponseSchema.parse(parsedAiResponse);

  return validatedAiResponse;
};

// {
//        "aiResponse": {
//          "id": "resp_6887c1078a6481a293aee579bad0ae7e0b76bb5eaad55b01",
//          "object": "response",
//          "created_at": 1753727239,
//          "status": "completed",
//          "background": false,
//          "error": null,
//          "incomplete_details": null,
//          "instructions": "\n## Instructions\nParse the natural language task description into structured JSON data.\n\nRespond with only a valid JSON object. Do not include explanations or any other text. Do not wrap the response in markdown or code block markers (```). Do not include comments.\n\n⚠️ This prompt is designed to be used with OpenAI's API using temperature = 0 to ensure deterministic and consistent output.\n\n## Output Format\nReturn only a single JSON object with the following structure:\n\n{\n  \"title\": \"Task title\",\n  \"dueDate\": \"ISO datetime string or null\",\n  \"priority\": \"low | medium | high\",\n  \"category\": \"work | personal | health | finance | errand\",\n  \"recurrence\": {\n    \"frequency\": \"daily | weekly | monthly\",\n    \"interval\": 1,\n    \"dayOfWeek\": number (0 = Sunday, 6 = Saturday) or null,\n    \"dayOfMonth\": number (1–31) or null,\n    \"endDate\": \"ISO datetime string or null\"\n  } or null,\n  \"subtasks\": [\"subtask1\", \"subtask2\"] or null\n}\n\n## Parsing Rules\n- Parse dates: \"tomorrow\" → today's date, \"next Friday\" → next Friday's date\n- Priority: \"urgent\" / \"high priority\" → \"high\", \"low priority\" → \"low\", default → \"medium\"\n- Category: infer from context or explicit mentions, otherwise default based on task title keywords\n- Recurrence:\n  - \"every Monday\" → weekly, \"daily\" → daily, \"monthly\" → monthly\n  - Use `dayOfWeek` for weekly recurrence (0 = Sunday to 6 = Saturday), otherwise null\n  - Use `dayOfMonth` for monthly recurrence (1–31), otherwise null\n- Subtasks: suggest logical steps if the task is complex or multi-step\n- Default priority: \"medium\" if not specified\n- Default category: infer based on task title if not specified\n\n## Examples\n\n### Example 1\nInput:\n\"\"\"\nSubmit Q2 report by next Friday and mark it high priority under Work\n\"\"\"\nOutput:\n{\n  \"title\": \"Submit Q2 report\",\n  \"dueDate\": \"2024-01-19T23:59:59Z\",\n  \"priority\": \"high\",\n  \"category\": \"work\",\n  \"recurrence\": null,\n  \"subtasks\": [\"Gather Q2 data\", \"Create report draft\", \"Review with team\", \"Submit final report\"]\n}\n\n### Example 2\nInput:\n\"\"\"\nSchedule team sync every Monday at 9am\n\"\"\"\nOutput:\n{\n  \"title\": \"Schedule team sync\",\n  \"dueDate\": \"2024-01-15T09:00:00Z\",\n  \"priority\": \"medium\",\n  \"category\": \"work\",\n  \"recurrence\": {\n    \"frequency\": \"weekly\",\n    \"interval\": 1,\n    \"dayOfWeek\": 1,\n    \"dayOfMonth\": null,\n    \"endDate\": null\n  },\n  \"subtasks\": [\"Send calendar invite\", \"Prepare agenda\", \"Send reminder\"]\n}\n\n### Example 3\nInput:\n\"\"\"\nPay electricity bill tomorrow\n\"\"\"\nOutput:\n{\n  \"title\": \"Pay electricity bill\",\n  \"dueDate\": \"2024-01-16T23:59:59Z\",\n  \"priority\": \"medium\",\n  \"category\": \"finance\",\n  \"recurrence\": null,\n  \"subtasks\": [\"Check bill amount\", \"Log into payment portal\", \"Confirm payment\"]\n}\n\n### Example 4 (Ambiguous Input)\nInput:\n\"\"\"\nPlan something soon\n\"\"\"\nOutput:\n{\n  \"title\": \"Plan something\",\n  \"dueDate\": null,\n  \"priority\": \"medium\",\n  \"category\": \"personal\",\n  \"recurrence\": null,\n  \"subtasks\": null\n}\n\n### Example 5 (No Date)\nInput:\n\"\"\"\nCheck project progress\n\"\"\"\nOutput:\n{\n  \"title\": \"Check project progress\",\n  \"dueDate\": null,\n  \"priority\": \"medium\",\n  \"category\": \"work\",\n  \"recurrence\": null,\n  \"subtasks\": [\"Review current status\", \"Update stakeholders\", \"Document findings\"]\n}\n\n## Input to Parse\n\"\"\"\n{naturalLanguage}\n\"\"\"\n",
//          "max_output_tokens": null,
//          "max_tool_calls": null,
//          "model": "gpt-4o-mini-2024-07-18",
//          "output": [
//            {
//              "id": "msg_6887c108132081a2b1691d060c83ea1b0b76bb5eaad55b01",
//              "type": "message",
//              "status": "completed",
//              "content": [
//                {
//                  "type": "output_text",
//                  "annotations": [],
//                  "logprobs": [],
//                  "text": "{\n  \"title\": \"Submit Q2 report\",\n  \"dueDate\": \"2024-01-19T23:59:59Z\",\n  \"priority\": \"high\",\n  \"category\": \"work\",\n  \"recurrence\": null,\n  \"subtasks\": [\"Gather Q2 data\", \"Create report draft\", \"Review with team\", \"Submit final report\"]\n}"
//                }
//              ],
//              "role": "assistant"
//            }
//          ],
//          "parallel_tool_calls": true,
//          "previous_response_id": null,
//          "prompt_cache_key": null,
//          "reasoning": {
//            "effort": null,
//            "summary": null
//          },
//          "safety_identifier": null,
//          "service_tier": "default",
//          "store": true,
//          "temperature": 0,
//          "text": {
//            "format": {
//              "type": "text"
//            }
//          },
//          "tool_choice": "auto",
//          "tools": [],
//          "top_logprobs": 0,
//          "top_p": 1,
//          "truncation": "disabled",
//          "usage": {
//            "input_tokens": 917,
//            "input_tokens_details": {
//              "cached_tokens": 0
//            },
//            "output_tokens": 80,
//            "output_tokens_details": {
//              "reasoning_tokens": 0
//            },
//            "total_tokens": 997
//          },
//          "user": null,
//          "metadata": {},
//          "output_text": "{\n  \"title\": \"Submit Q2 report\",\n  \"dueDate\": \"2024-01-19T23:59:59Z\",\n  \"priority\": \"high\",\n  \"category\": \"work\",\n  \"recurrence\": null,\n  \"subtasks\": [\"Gather Q2 data\", \"Create report draft\", \"Review with team\", \"Submit final report\"]\n}"
//        }
//      }
