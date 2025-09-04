import { ParseTaskConfig } from "@types";

export const DEFAULT_PARSE_TASK_CONFIG: ParseTaskConfig = {
  categories: ["work", "personal", "health", "finance", "errand"],
  priorityLevels: ["low", "medium", "high", "critical"],
  frequencies: ["daily", "weekly", "monthly"],
};
